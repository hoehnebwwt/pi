import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./suite/harness.ts";

describe("/todo command", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("adds a todo item", async () => {
		const harness = await createHarness();
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("done")]);

		await harness.session.prompt("/todo add Buy milk");

		// The command should be handled without sending to the model
		expect(harness.session.getTodos()).toHaveLength(1);
		expect(harness.session.getTodos()[0].text).toBe("Buy milk");
	});

	it("lists all todos", async () => {
		const harness = await createHarness();
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("done")]);

		await harness.session.prompt("/todo add Task 1");
		await harness.session.prompt("/todo add Task 2");
		await harness.session.prompt("/todo list");

		const todos = harness.session.getTodos();
		expect(todos).toHaveLength(2);
		expect(todos[0].text).toBe("Task 1");
		expect(todos[1].text).toBe("Task 2");
	});

	it("completes a todo item", async () => {
		const harness = await createHarness();
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("done")]);

		await harness.session.prompt("/todo add Task");
		const todos = harness.session.getTodos();
		const id = todos[0].id;

		await harness.session.prompt(`/todo complete ${id}`);

		const updatedTodos = harness.session.getTodos();
		expect(updatedTodos[0].completed).toBe(true);
	});

	it("clears all todos", async () => {
		const harness = await createHarness();
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("done")]);

		await harness.session.prompt("/todo add Task 1");
		await harness.session.prompt("/todo add Task 2");
		await harness.session.prompt("/todo clear");

		expect(harness.session.getTodos()).toHaveLength(0);
	});
});
