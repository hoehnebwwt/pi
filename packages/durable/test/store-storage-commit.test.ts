import { describe, it, beforeEach, afterEach } from "vitest";
import { expect } from "vitest";
import { runInNewContext } from "vm";
import { setFlagsFromString } from "v8";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { mkdir, rm } from "fs/promises";
import {
	Store,
	StoreStorage,
	CommitResult,
	Seq,
	DocumentId,
	ConversationId,
	EntryId,
	idFromNumber,
	ROOT_CONVERSATION_ID,
} from "@earendil-works/pi-durable";
import { Context } from "@earendil-works/pi-agent-core";
import { MemoryStorage } from "@earendil-works/pi-durable";

describe("store-storage-commit", () => {
	let context: Context;
	let tmpPath: string;

	beforeEach(async () => {
		context = { telemetry: { recordCount: () => {} } } as unknown as Context;
		tmpPath = join(tmpdir(), `pi-test-${randomUUID()}`);
		await mkdir(tmpPath, { recursive: true });
	});

	afterEach(async () => {
		await rm(tmpPath, { recursive: true, force: true });
	});

	async function storePath(): Promise<string> {
		return join(tmpPath, `store-${randomUUID()}.db`);
	}

	async function counted(path?: string) {
		const storePath = path || (await storePath());
		const store = await Store.open(storePath, context);
		const storage = new StoreStorage(store, "test");
		const counts = { statements: 0, transactions: 0 };
		const faults = { fail: undefined as ((sql: string, index: number) => boolean) | undefined, commit: false, hold: undefined as ((sql: string, index: number) => Promise<void> | undefined) | undefined };
		return { store, storage, counts, faults };
	}

	async function reopen(path: string) {
		const store = await Store.open(path, context);
		const storage = new StoreStorage(store, "test");
		return { store, storage };
	}

	async function macrotask() {
		return new Promise((resolve) => setImmediate(resolve));
	}

	async function outboxSeqs(store: Store): Promise<Seq[]> {
		const seqs: Seq[] = [];
		for await (const batch of store.export(context)) {
			if (batch.kind === "batch") {
				seqs.push(batch.seq);
			}
		}
		return seqs;
	}

	function entryWrite(id: EntryId) {
		return { type: "entry", id, value: { kind: "a" } } as const;
	}

	const SEED = [
		{ type: "conversation", value: { id: ROOT_CONVERSATION_ID } },
		{ type: "entry", id: idFromNumber<EntryId>(101), value: { kind: "a" } },
		{ type: "entry", id: idFromNumber<EntryId>(102), value: { kind: "b" } },
		{ type: "entry", id: idFromNumber<EntryId>(103), value: { kind: "c" } },
	] as const;

	function batches(third: "valid" | "refused") {
		return [
			[entryWrite(idFromNumber<EntryId>(1))],
			[entryWrite(idFromNumber<EntryId>(2))],
			[
				entryWrite(idFromNumber<EntryId>(3)),
				third === "valid" ? { type: "conversation", value: { id: ROOT_CONVERSATION_ID } } : { type: "invalid" },
			],
		];
	}

	async function commitWrites(storage: StoreStorage, writes: any[], context: Context) {
		const result = await storage.commit([writes], () => {}, context);
		if (result.kind === "stored") return result.stored;
		throw new Error("commit failed");
	}

	async function stateOf(storage: StoreStorage) {
		return {
			entries: (await storage.entry(idFromNumber<EntryId>(1), context))?.value ?? null,
			document: (await storage.document(idFromNumber<DocumentId>(102), "current", context))?.value ?? null,
			child: (await storage.conversation(idFromNumber<ConversationId>(105), context)) ?? null,
		};
	}

	/** What a call returned and what it left: its result, its receipts' seqs after the store's last one, the state. */
	async function outcomeOf(storage: StoreStorage, third: "valid" | "refused", last: number) {
		const seqs: number[] = [];
		const result: CommitResult = await storage.commit(
			batches(third),
			(_index, seq) => seqs.push(seq - last),
			context,
		);
		return {
			stored: result.stored,
			refused: result.kind === "refused" ? String(result.refused) : "undefined",
			seqs,
			state: await stateOf(storage),
		};
	}

	/** Every error in `error`'s cause chain, as text. */
	function chain(error: unknown): string[] {
		const messages: string[] = [];
		for (let at = error; at instanceof Error; at = at.cause) messages.push(at.message);
		return messages;
	}

	it.each(["valid", "refused"] as const)(
		"rolls a 3-batch call back at a failure of any of its statements, as at a failed COMMIT, and reopens before it (third %s)",
		async (third) => {
			// What MemoryStorage makes of the call: the outcome every retry must reach.
			const memory = new MemoryStorage();
			await commitWrites(memory, [{ type: "conversation", value: { id: ROOT_CONVERSATION_ID } }], context);
			await commitWrites(memory, SEED, context);
			const expected = await outcomeOf(memory, third, 2);
			expect(expected).toMatchObject(
				third === "valid" ? { stored: 3, seqs: [1, 2, 3] } : { stored: 2, seqs: [1, 2] },
			);
			// The statements of the call's transaction (a read transaction after it would count its own).
			const probe = await counted();
			await commitWrites(probe.storage, SEED, context);
			const result = await probe.storage.commit(batches(third), () => {}, context);
			const total = probe.counts.statements;
			// Its cost: no read beyond a batch's checks, the metadata once (statement counts per batch in the cost guard).
			expect(total).toBe(third === "valid" ? 29 : 23);
			expect(result.stored).toBe(expected.stored);
			expect(await stateOf(probe.storage)).toEqual(expected.state);
			await probe.store.close(context);
			// Each statement in turn, then the COMMIT.
			for (let at = 1; at <= total + 1; at++) {
				const path = await storePath();
				const opened = await counted(path);
				await commitWrites(opened.storage, SEED, context);
				const last = opened.store.lastSeq;
				const outbox = await outboxSeqs(opened.store);
				const before = await stateOf(opened.storage);
				if (at <= total) opened.faults.fail = (_sql, index) => index === at;
				else opened.faults.commit = true;
				const receipts: number[] = [];
				const error = await opened.storage
					.commit(batches(third), (each) => receipts.push(each), context)
					.then(
						() => undefined,
						(rejection: unknown) => rejection,
					);
				expect(receipts).toEqual([]);
				expect(opened.store.lastSeq).toBe(last);
				if (at <= total) {
					// A rollback: the call rejects with its failure, the store goes on.
					expect(chain(error)).toContain(`injected: statement ${at} failed`);
					expect(await stateOf(opened.storage)).toEqual(before);
				} else {
					expect(error).toMatchObject({ code: "unavailable", reason: "storage_failed" });
				}
				await opened.store.close(context);
				// On disk: as before the call, the seq, the outbox, the records and the allocator.
				const again = await reopen(path);
				expect(again.store.lastSeq).toBe(last);
				expect(await outboxSeqs(again.store)).toEqual(outbox);
				expect(await stateOf(again.storage)).toEqual(before);
				expect(await again.storage.mintId<EntryId>()).toBeGreaterThan(100);
				// A retry reaches MemoryStorage's outcome.
				expect(await outcomeOf(again.storage, third, last)).toEqual(expected);
				expect(await outboxSeqs(again.store)).toEqual([...outbox, ...expected.seqs.map((seq) => last + seq)]);
				await again.store.close(context);
			}
		},
		{ timeout: 60000 },
	);

	it("a call on a closed storage, or on a stopped store, rejects and stores nothing", async () => {
		const { store, storage, faults } = await counted();
		const entry = await storage.mintId<EntryId>();
		faults.commit = true;
		await expect(commitWrites(storage, [entryWrite(entry)], context)).rejects.toMatchObject({
			reason: "storage_failed",
		});
		await expect(storage.commit([[entryWrite(entry)]], () => {}, context)).rejects.toMatchObject({
			reason: "storage_failed",
		});
		await store.close(context);
		const other = await counted();
		await other.storage.close(context);
		await expect(other.storage.commit([[entryWrite(entry)]], () => {}, context)).rejects.toThrow("closed");
		await other.store.close(context);
	});

	it("a call queued when the store closes rejects released, and stores nothing; the running one is stored", async () => {
		const path = await storePath();
		const { store, storage, faults } = await counted(path);
		const [first, second] = [await storage.mintId<EntryId>(), await storage.mintId<EntryId>()];
		const entered = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		faults.hold = (_sql, index) => {
			if (index !== 1) return undefined;
			entered.resolve();
			return release.promise;
		};
		const running = storage.commit([[entryWrite(first)]], () => {}, context);
		await entered.promise;
		const queued = storage.commit([[entryWrite(second)]], () => {}, context);
		const closing = store.close(context);
		release.resolve();
		expect(await running).toEqual({ kind: "stored", stored: 1 });
		await expect(queued).rejects.toMatchObject({ code: "released" });
		await closing;
		const again = await reopen(path);
		expect(await again.storage.entry(first, context)).toBeDefined();
		expect(await again.storage.entry(second, context)).toBeUndefined();
		await again.store.close(context);
	});
});

describe("durability", () => {
	it("keeps every batch of a stored call across a crash: reopened, the seqs, rows, documents and ids are there", async () => {
		const path = await storePath();
		const { store, storage } = await counted(path);
		const entry = await storage.mintId<EntryId>();
		const document = await storage.mintId<DocumentId>();
		const record = {
			id: document,
			kind: "n",
			scope: { kind: "conversation", conversationId: ROOT_CONVERSATION_ID },
			history: "rewindable",
			fork: "asOf",
		} as const;
		const seqs: Seq[] = [];
		await storage.commit(
			[
				[entryWrite(entry)],
				[{ type: "document.create", record, content: { kind: "base", version: 1, value: { n: 1 } } }],
				[{ type: "document.change", id: document, content: { kind: "delta", version: 1, ops: [["s", ["n"], 2]] } }],
			],
			(_index, seq) => seqs.push(seq),
			context,
		);
		const minted = await storage.mintId<EntryId>();
		// A crash: the store is never closed; another process opens the file.
		const { store: other, storage: reopened } = await reopen(path);
		expect((await reopened.entry(entry, context))?.commitSeq).toBe(seqs[0]);
		expect((await reopened.document(document, seqs[1]!, context))?.value).toEqual({ n: 1 });
		expect((await reopened.document(document, "current", context))?.value).toEqual({ n: 2 });
		expect(await reopened.mintId<EntryId>()).toBeGreaterThan(document);
		expect(await commitWrites(reopened, [entryWrite(minted)], context)).toBe(seqs[2]! + 1);
		await other.close(context);
		await store.close(context);
	});
});

describe("publication", () => {
	it("publishes each commit of a call in a host batch of its own, after the call's one transaction", async () => {
		const { store, storage, counts } = await counted();
		const host = createHost({ store, onError: () => {} });
		const session = new SessionImpl(storage);
		const events: string[] = [];
		session.followCommits((commit) => {
			if (commit.kind !== "stored") return;
			const batch = store.batch!;
			events.push(`publish ${commit.seq} running=${batch.running}`);
			batch.flushing(() => events.push(`flush ${commit.seq}`));
		});
		// Hold the first call, so the commits after it are sent together in the next one.
		const calls: number[] = [];
		const gate = Promise.withResolvers<void>();
		const commit = storage.commit.bind(storage);
		storage.commit = async (batches, receive, ctx) => {
			calls.push(batches.length);
			if (calls.length === 1) await gate.promise;
			return commit(batches, receive, ctx);
		};
		const first = session.commit((tx) => tx.appendEntry(ROOT_CONVERSATION_ID, { kind: "a" }), context);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const rest = [1, 2, 3].map((n) =>
			session.commit((tx) => tx.appendEntry(ROOT_CONVERSATION_ID, { kind: `b${n}` }), context),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const before = counts.transactions;
		gate.resolve();
		await Promise.all([first, ...rest]);
		expect(calls).toEqual([1, 3]);
		expect(counts.transactions - before).toBe(2);
		const seq = store.lastSeq;
		expect(events).toEqual(
			[seq - 3, seq - 2, seq - 1, seq].flatMap((each) => [`publish ${each} running=true`, `flush ${each}`]),
		);
		await session.close(context);
		await host.close(context);
		await store.close(context);
	});
});

describe("other users of the store", () => {
	it("another owner's call waits for a series in its transaction; the series' receipts come first", async () => {
		const { store, storage, faults } = await counted();
		const other = await StoreStorage.open(store, "other", context);
		const [first, second] = [await storage.mintId<EntryId>(), await storage.mintId<EntryId>()];
		const entered = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		faults.hold = (_sql, index) => {
			if (index !== 2) return undefined;
			entered.resolve();
			return release.promise;
		};
		const events: string[] = [];
		const series = storage.commit(
			[[entryWrite(first)], [entryWrite(second)]],
			(index, seq) => events.push(`harness ${index} ${seq}`),
			context,
		);
		await entered.promise;
		const waiting = other.commit(
			[[{ type: "conversation", value: { id: ROOT_CONVERSATION_ID } }]],
			(index, seq) => events.push(`other ${index} ${seq}`),
			context,
		);
		await macrotask();
		expect(events).toEqual([]);
		const last = store.lastSeq;
		release.resolve();
		await Promise.all([series, waiting]);
		expect(events).toEqual([`harness 0 ${last + 1}`, `harness 1 ${last + 2}`, `other 0 ${last + 3}`]);
		expect((await outboxSeqs(store)).slice(-3)).toEqual([last + 1, last + 2, last + 3]);
		await other.close(context);
		await store.close(context);
	});

	it("a read during a series sees all of it or none of it", async () => {
		const { store, storage, faults } = await counted();
		const [first, second] = [await storage.mintId<EntryId>(), await storage.mintId<EntryId>()];
		const entered = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		// Held after the first batch's writes, in the second batch's check.
		let claimReads = 0;
		faults.hold = (sql) => {
			if (!sql.includes("record_ids") || ++claimReads !== 2) return undefined;
			entered.resolve();
			return release.promise;
		};
		const series = storage.commit([[entryWrite(first)], [entryWrite(second)]], () => {}, context);
		await entered.promise;
		const read = Promise.all([storage.entry(first, context), storage.entry(second, context)]);
		await macrotask();
		release.resolve();
		await series;
		const [one, two] = await read;
		expect([one === undefined, two === undefined]).toEqual([false, false]);
		await store.close(context);
	});

	it("an export holds the queue: a series waits for it and is not in its archive", async () => {
		const { store, storage } = await counted();
		const entry = await storage.mintId<EntryId>();
		const last = store.lastSeq;
		const parts = store.export(context);
		const manifest = await parts.next();
		expect(manifest.value).toMatchObject({ kind: "manifest", lastSeq: last });
		let settled = false;
		const series = storage
			.commit([[entryWrite(entry)]], () => {}, context)
			.finally(() => {
				settled = true;
			});
		await macrotask();
		expect(settled).toBe(false);
		await parts.return?.();
		expect(await series).toEqual({ kind: "stored", stored: 1 });
		expect(store.lastSeq).toBe(last + 1);
		await store.close(context);
	});
});

describe("GC", () => {
	it("keeps nothing of a settled call: its batches are collected", async () => {
		setFlagsFromString("--expose-gc");
		const gc = runInNewContext("gc") as () => void;
		const { store, storage } = await counted();
		const sent = async (): Promise<WeakRef<object>> => {
			const batches = [[entryWrite(await storage.mintId<EntryId>())]];
			await storage.commit(batches, () => {}, context);
			return new WeakRef(batches);
		};
		const ref = await sent();
		for (let round = 0; round < 10 && ref.deref() !== undefined; round++) {
			await new Promise((resolve) => setImmediate(resolve));
			gc();
		}
		expect(ref.deref()).toBeUndefined();
		await store.close(context);
	});
});
