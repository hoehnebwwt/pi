import { describe, expect, it, vi } from "vitest";
import { TodoManager } from "../src/core/todo-manager.ts";

describe("TodoManager", () => {
	it("adds a todo item", () => {
		const manager = new TodoManager();
		const item = manager.add("Buy milk");

		expect(item.text).toBe("Buy milk");
		expect(item.completed).toBe(false);
		expect(item.id).toBe("1");
	});

	it("lists all todos", () => {
		const manager = new TodoManager();
		manager.add("First task");
		manager.add("Second task");

		const todos = manager.list();
		expect(todos).toHaveLength(2);
		expect(todos[0].text).toBe("First task");
		expect(todos[1].text).toBe("Second task");
	});

	it("completes a todo", () => {
		const manager = new TodoManager();
		const item = manager.add("Task to complete");

		const completed = manager.complete(item.id);
		expect(completed?.completed).toBe(true);

		const todos = manager.list();
		expect(todos[0].completed).toBe(true);
	});

	it("returns undefined when completing non-existent todo", () => {
		const manager = new TodoManager();
		const result = manager.complete("999");
		expect(result).toBeUndefined();
	});

	it("removes a todo", () => {
		const manager = new TodoManager();
		const item = manager.add("Task to remove");

		const removed = manager.remove(item.id);
		expect(removed).toBe(true);

		const todos = manager.list();
		expect(todos).toHaveLength(0);
	});

	it("clears all todos", () => {
		const manager = new TodoManager();
		manager.add("Task 1");
		manager.add("Task 2");

		manager.clear();
		const todos = manager.list();
		expect(todos).toHaveLength(0);
	});

	it("gets todo by id", () => {
		const manager = new TodoManager();
		const item = manager.add("Find me");

		const found = manager.getById(item.id);
		expect(found?.text).toBe("Find me");
	});

	it("returns undefined for non-existent id", () => {
		const manager = new TodoManager();
		const found = manager.getById("999");
		expect(found).toBeUndefined();
	});

	it("maintains insertion order", () => {
		const manager = new TodoManager();
		const item1 = manager.add("First");
		const item2 = manager.add("Second");
		const item3 = manager.add("Third");

		const todos = manager.list();
		expect(todos[0].id).toBe(item1.id);
		expect(todos[1].id).toBe(item2.id);
		expect(todos[2].id).toBe(item3.id);
	});

	it("increments todo IDs sequentially", () => {
		const manager = new TodoManager();
		const item1 = manager.add("Task 1");
		const item2 = manager.add("Task 2");
		const item3 = manager.add("Task 3");

		expect(item1.id).toBe("1");
		expect(item2.id).toBe("2");
		expect(item3.id).toBe("3");
	});

	it("preserves todo state after completion", () => {
		const manager = new TodoManager();
		const item = manager.add("Task");
		manager.complete(item.id);

		const todos = manager.list();
		expect(todos[0].completed).toBe(true);
		expect(todos[0].text).toBe("Task");
		expect(todos[0].id).toBe(item.id);
	});
});
