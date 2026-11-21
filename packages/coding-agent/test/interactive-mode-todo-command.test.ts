import { describe, expect, it, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { TodoManager } from "../src/core/todo-manager.ts";

type TodoCommandContext = {
	todoManager: TodoManager;
	showStatus: (message: string) => void;
	editor: { setText: (text: string) => void };
};

type InteractiveModePrototype = {
	handleTodoCommand(this: TodoCommandContext, args: string): void;
};

const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrototype;

describe("InteractiveMode /todo", () => {
	it("adds a todo item", () => {
		const todoManager = new TodoManager();
		const showStatus = vi.fn();
		const setText = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "add Buy groceries");

		expect(todoManager.list()).toHaveLength(1);
		expect(todoManager.list()[0].text).toBe("Buy groceries");
		expect(showStatus).toHaveBeenCalledWith("Added todo #1: Buy groceries");
	});

	it("lists all todos", () => {
		const todoManager = new TodoManager();
		todoManager.add("First task");
		todoManager.add("Second task");

		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "list");

		expect(showStatus).toHaveBeenCalledWith(
			expect.stringContaining("[ ] #1: First task"),
		);
		expect(showStatus).toHaveBeenCalledWith(
			expect.stringContaining("[x] #2: Second task"),
		);
	});

	it("shows empty message when no todos exist", () => {
		const todoManager = new TodoManager();
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "list");

		expect(showStatus).toHaveBeenCalledWith("No todos yet");
	});

	it("completes a todo item", () => {
		const todoManager = new TodoManager();
		const item = todoManager.add("Task to complete");
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, `complete ${item.id}`);

		expect(todoManager.getById(item.id)?.completed).toBe(true);
		expect(showStatus).toHaveBeenCalledWith(`Completed todo #${item.id}: Task to complete`);
	});

	it("shows error when completing non-existent todo", () => {
		const todoManager = new TodoManager();
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "complete 999");

		expect(showStatus).toHaveBeenCalledWith("Todo #999 not found");
	});

	it("shows usage when add has no text", () => {
		const todoManager = new TodoManager();
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "add");

		expect(showStatus).toHaveBeenCalledWith("Usage: /todo add <text>");
		expect(todoManager.list()).toHaveLength(0);
	});

	it("shows usage when complete has no id", () => {
		const todoManager = new TodoManager();
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "complete");

		expect(showStatus).toHaveBeenCalledWith("Usage: /todo complete <id>");
	});

	it("shows usage for unknown subcommand", () => {
		const todoManager = new TodoManager();
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "unknown");

		expect(showStatus).toHaveBeenCalledWith("Usage: /todo [add <text>|list|complete <id>]");
	});

	it("defaults to list when no subcommand given", () => {
		const todoManager = new TodoManager();
		todoManager.add("Task 1");
		const showStatus = vi.fn();

		const context: TodoCommandContext = {
			todoManager,
			showStatus,
			editor: { setText: vi.fn() },
		};

		interactiveModePrototype.handleTodoCommand.call(context, "");

		expect(showStatus).toHaveBeenCalledWith(
			expect.stringContaining("[ ] #1: Task 1"),
		);
	});
});
