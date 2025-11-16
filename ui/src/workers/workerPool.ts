/**
 * Worker Pool Manager
 * Manages a pool of web workers for parallel processing
 */

import type { ImageProcessorMessage, ImageProcessorResponse } from './imageProcessor.worker';

export class WorkerPool {
	private workers: Worker[] = [];
	private availableWorkers: Worker[] = [];
	private pendingTasks: Array<{
		message: ImageProcessorMessage;
		resolve: (value: ImageProcessorResponse) => void;
		reject: (error: Error) => void;
	}> = [];
	private maxWorkers: number;
	private workerUrl: URL;

	constructor(maxWorkers: number = navigator.hardwareConcurrency || 4) {
		this.maxWorkers = Math.max(1, Math.min(maxWorkers, 8)); // Limit to 8 workers max
		// Use Vite's worker URL syntax
		this.workerUrl = new URL('./imageProcessor.worker.ts', import.meta.url);

		// Initialize worker pool
		for (let i = 0; i < this.maxWorkers; i++) {
			this.createWorker();
		}
	}

	private createWorker(): Worker {
		// Create worker using Vite's worker URL
		const worker = new Worker(this.workerUrl, { type: 'module' });
		this.workers.push(worker);
		this.availableWorkers.push(worker);

		worker.onmessage = (e: MessageEvent<ImageProcessorResponse>) => {
			const task = this.pendingTasks.shift();
			if (task) {
				if (e.data.success) {
					task.resolve(e.data);
				} else {
					task.reject(new Error(e.data.error || 'Worker task failed'));
				}
			}
			this.availableWorkers.push(worker);
			this.processNextTask();
		};

		worker.onerror = (error) => {
			// Extract error message from Event object
			const errorMessage = error.message || error.filename || 'Worker error occurred';
			const errorDetails = error.filename 
				? `${errorMessage} at ${error.filename}:${error.lineno || '?'}:${error.colno || '?'}`
				: errorMessage;
			console.error('Worker error:', errorDetails, error);
			const task = this.pendingTasks.shift();
			if (task) {
				task.reject(new Error(errorDetails));
			}
			this.availableWorkers.push(worker);
			this.processNextTask();
		};

		return worker;
	}

	private processNextTask(): void {
		if (this.pendingTasks.length === 0 || this.availableWorkers.length === 0) {
			return;
		}

		const task = this.pendingTasks[0];
		const worker = this.availableWorkers.shift();

		if (worker && task) {
			this.pendingTasks.shift();
			worker.postMessage(task.message);
		}
	}

	public async execute(message: ImageProcessorMessage): Promise<ImageProcessorResponse> {
		return new Promise((resolve, reject) => {
			this.pendingTasks.push({ message, resolve, reject });
			this.processNextTask();
		});
	}

	public async executeBatch(messages: ImageProcessorMessage[]): Promise<ImageProcessorResponse[]> {
		return Promise.all(messages.map(msg => this.execute(msg)));
	}

	public terminate(): void {
		this.workers.forEach(worker => worker.terminate());
		this.workers = [];
		this.availableWorkers = [];
		this.pendingTasks = [];
	}

	public getStats() {
		return {
			totalWorkers: this.workers.length,
			availableWorkers: this.availableWorkers.length,
			pendingTasks: this.pendingTasks.length,
		};
	}
}

// Singleton instance
let workerPoolInstance: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
	if (!workerPoolInstance) {
		workerPoolInstance = new WorkerPool();
	}
	return workerPoolInstance;
}

export function terminateWorkerPool(): void {
	if (workerPoolInstance) {
		workerPoolInstance.terminate();
		workerPoolInstance = null;
	}
}

