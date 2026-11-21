import { describe, expect, it } from "vitest";
import { TodoManager } from "../src/core/todo-manager.ts";

describe("TodoManager", () => {
	it("adds a todo item", () => {
		const manager = new TodoManager();
		const item = manager.add("Buy milk");

		expect(item.text).toBe("Buy milk");
		expect(item.completed).toBe(false);
		expect(item.id).toBeDefined();
	});

	it("lists all todos in creation order", () => {
		const manager = new TodoManager();
		manager.add("First");
		manager.add("Second");
		manager.add("Third");

		const todos = manager.list();
		expect(todos).toHaveLength(3);
		expect(todos[0].text).toBe("First");
		expect(todos[1].text).toBe("Second");
		expect(todos[2].text).toBe("Third");
	});

	it("completes a todo item", () => {
		const manager = new TodoManager();
		const item = manager.add("Task");
		const id = item.id;

		const completed = manager.complete(id);
		expect(completed?.completed).toBe(true);

		const todos = manager.list();
		expect(todos[0].completed).toBe(true);
	});

	it("removes a todo item", () => {
		const manager = new TodoManager();
		const item1 = manager.add("Task 1");
		const item2 = manager.add("Task 2");

		const removed = manager.remove(item1.id);
		expect(removed).toBe(true);

		const todos = manager.list();
		expect(todos).toHaveLength(1);
		expect(todos[0].text).toBe("Task 2");
	});

	it("clears all todos", () => {
		const manager = new TodoManager();
		manager.add("Task 1");
		manager.add("Task 2");

		manager.clear();
		const todos = manager.list();
		expect(todos).toHaveLength(0);
	});

	it("returns undefined when completing non-existent todo", () => {
		const manager = new TodoManager();
		const result = manager.complete("non-existent");
		expect(result).toBeUndefined();
	});

	it("returns false when removing non-existent todo", () => {
		const manager = new TodoManager();
		const result = manager.remove("non-existent");
		expect(result).toBe(false);
	});

	it("tracks creation timestamps", () => {
		const manager = new TodoManager();
		const before = Date.now();
		const item = manager.add("Task");
		const after = Date.now();

		expect(item.createdAt).toBeGreaterThanOrEqual(before);
		expect(item.createdAt).toBeLessThanOrEqual(after);
	});

	it("generates unique IDs for each todo", () => {
		const manager = new TodoManager();
		const item1 = manager.add("Task 1");
		const item2 = manager.add("Task 2");
		const item3 = manager.add("Task 3");

		const ids = new Set([item1.id, item2.id, item3.id]);
		expect(ids.size).toBe(3);
	});
});
