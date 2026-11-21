import { describe, expect, it } from "vitest";
import { TodoManager } from "../src/core/todo-manager.ts";

describe("TodoManager", () => {
	it("adds a todo item", () => {
		const manager = new TodoManager();
		const item = manager.add("Test task");

		expect(item.id).toBe("1");
		expect(item.text).toBe("Test task");
		expect(item.completed).toBe(false);
		expect(item.createdAt).toBeGreaterThan(0);
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

		const completed = manager.complete(item.id);
		expect(completed?.completed).toBe(true);
		expect(manager.getById(item.id)?.completed).toBe(true);
	});

	it("returns undefined when completing non-existent todo", () => {
		const manager = new TodoManager();
		const result = manager.complete("999");

		expect(result).toBeUndefined();
	});

	it("removes a todo item", () => {
		const manager = new TodoManager();
		const item = manager.add("Task");

		const removed = manager.remove(item.id);
		expect(removed).toBe(true);
		expect(manager.getById(item.id)).toBeUndefined();
	});

	it("returns false when removing non-existent todo", () => {
		const manager = new TodoManager();
		const removed = manager.remove("999");

		expect(removed).toBe(false);
	});

	it("clears all todos", () => {
		const manager = new TodoManager();
		manager.add("Task 1");
		manager.add("Task 2");

		manager.clear();
		expect(manager.list()).toHaveLength(0);
	});

	it("resets id counter after clear", () => {
		const manager = new TodoManager();
		manager.add("Task 1");
		manager.clear();

		const item = manager.add("Task 2");
		expect(item.id).toBe("1");
	});

	it("retrieves todo by id", () => {
		const manager = new TodoManager();
		const item = manager.add("Task");

		const retrieved = manager.getById(item.id);
		expect(retrieved).toEqual(item);
	});

	it("returns undefined for non-existent id", () => {
		const manager = new TodoManager();
		const retrieved = manager.getById("999");

		expect(retrieved).toBeUndefined();
	});

	it("increments id for each new todo", () => {
		const manager = new TodoManager();
		const item1 = manager.add("Task 1");
		const item2 = manager.add("Task 2");
		const item3 = manager.add("Task 3");

		expect(item1.id).toBe("1");
		expect(item2.id).toBe("2");
		expect(item3.id).toBe("3");
	});
});
