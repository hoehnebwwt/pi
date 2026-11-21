// Handler for the /todo slash command in interactive mode.

import { Spacer, ThemedText, theme } from "@earendil-works/pi-tui";
import type { Container } from "@earendil-works/pi-tui";
import type { TodoManager } from "../../core/todo-manager.ts";

export function handleTodoCommand(
	text: string,
	todoManager: TodoManager,
	chatContainer: Container,
	ui: { requestRender: () => void },
): void {
	const args = text.replace(/^\/todo\s*/, "").trim().split(/\s+/);
	const command = args[0];

	if (!command || command === "list") {
		const todos = todoManager.list();
		if (todos.length === 0) {
			chatContainer.addChild(new Spacer(1));
			chatContainer.addChild(new ThemedText(() => theme.fg("dim", "No todos yet. Use /todo add <text> to create one."), 1, 0));
		} else {
			chatContainer.addChild(new Spacer(1));
			chatContainer.addChild(new ThemedText(() => theme.fg("bold", "Todos:"), 1, 0));
			for (const todo of todos) {
				const status = todo.completed ? "✓" : "○";
				const style = todo.completed ? "dim" : "default";
				const text = `  ${status} [${todo.id}] ${todo.text}`;
				chatContainer.addChild(new ThemedText(() => theme.fg(style, text), 1, 0));
			}
		}
	} else if (command === "add") {
		const todoText = args.slice(1).join(" ");
		if (!todoText) {
			chatContainer.addChild(new Spacer(1));
			chatContainer.addChild(new ThemedText(() => theme.fg("error", "Usage: /todo add <text>"), 1, 0));
		} else {
			const item = todoManager.add(todoText);
			chatContainer.addChild(new Spacer(1));
			chatContainer.addChild(new ThemedText(() => theme.fg("success", `Added todo [${item.id}]: ${item.text}`), 1, 0));
		}
	} else if (command === "complete") {
		const todoId = args[1];
		if (!todoId) {
			chatContainer.addChild(new Spacer(1));
			chatContainer.addChild(new ThemedText(() => theme.fg("error", "Usage: /todo complete <id>"), 1, 0));
		} else {
			const item = todoManager.complete(todoId);
			if (item) {
				chatContainer.addChild(new Spacer(1));
				chatContainer.addChild(new ThemedText(() => theme.fg("success", `Completed todo [${item.id}]: ${item.text}`), 1, 0));
			} else {
				chatContainer.addChild(new Spacer(1));
				chatContainer.addChild(new ThemedText(() => theme.fg("error", `Todo [${todoId}] not found`), 1, 0));
			}
		}
	} else {
		chatContainer.addChild(new Spacer(1));
		chatContainer.addChild(new ThemedText(() => theme.fg("error", "Usage: /todo <add|list|complete> [args]"), 1, 0));
	}

	ui.requestRender();
}
