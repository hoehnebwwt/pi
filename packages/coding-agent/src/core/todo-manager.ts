// Todo manager for session-specific todo items.

export interface TodoItem {
	id: string;
	text: string;
	completed: boolean;
	createdAt: number;
}

export class TodoManager {
	private todos: Map<string, TodoItem> = new Map();
	private nextId = 0;

	add(text: string): TodoItem {
		const id = String(this.nextId++);
		const item: TodoItem = {
			id,
			text,
			completed: false,
			createdAt: Date.now(),
		};
		this.todos.set(id, item);
		return item;
	}

	list(): TodoItem[] {
		return Array.from(this.todos.values()).sort((a, b) => a.createdAt - b.createdAt);
	}

	complete(id: string): TodoItem | undefined {
		const item = this.todos.get(id);
		if (item) {
			item.completed = true;
		}
		return item;
	}

	remove(id: string): boolean {
		return this.todos.delete(id);
	}

	clear(): void {
		this.todos.clear();
	}

	getAll(): TodoItem[] {
		return this.list();
	}
}
