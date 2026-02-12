import { Notice } from 'obsidian';
import { log } from './logger';

export interface ErrorHandlerOptions {
    context: string;
    message?: string;
    showNotice?: boolean;
    rethrow?: boolean;
}

export function handleError(err: unknown, options: ErrorHandlerOptions): void {
    const { context, message, showNotice = true, rethrow = false } = options;
    
    const errorMessage = err instanceof Error ? err.message : String(err);
    const logMessage = message 
        ? `[${context}] ${message}: ${errorMessage}`
        : `[${context}] ${errorMessage}`;
    
    log(logMessage, err);
    
    if (showNotice) {
        const noticeMessage = message || `${context}失败`;
        new Notice(noticeMessage);
    }
    
    if (rethrow) {
        throw err;
    }
}

export function handleAsyncError(options: ErrorHandlerOptions): (err: unknown) => void {
    return (err: unknown) => handleError(err, options);
}

export function tryAsync<T>(
    fn: () => Promise<T>,
    options: ErrorHandlerOptions
): Promise<T | undefined> {
    return fn().catch((err) => {
        handleError(err, options);
        return undefined;
    });
}
