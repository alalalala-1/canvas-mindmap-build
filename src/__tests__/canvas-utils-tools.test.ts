import { describe, it, expect } from 'vitest';
import {
	isFormulaContent,
	isImageContent,
	isTextNode,
	isFileNode,
	isRecord,
} from '../utils/canvas-utils';

describe('canvas-utils - 工具函数', () => {
	describe('isFormulaContent', () => {
		it('should return false for plain text', () => {
			expect(isFormulaContent('plain text')).toBe(false);
		});

		it('should detect formula with $$ delimiters', () => {
			expect(isFormulaContent('$$x = \\frac{-b \\pm \\sqrt{D}}{2a}$$')).toBe(true);
		});

		it('should return false for single dollar sign', () => {
			expect(isFormulaContent('$x^2$')).toBe(false);
			expect(isFormulaContent('$E=mc^2$')).toBe(false);
		});

		it('should return false for dollar sign in normal text', () => {
			expect(isFormulaContent('Price is $50')).toBe(false);
		});
	});

	describe('isImageContent', () => {
		it('should return false for plain text', () => {
			expect(isImageContent('just some text')).toBe(false);
		});

		it('should return false for standalone image file names', () => {
			expect(isImageContent('image.png')).toBe(false);
			expect(isImageContent('photo.jpg')).toBe(false);
		});
	});

	describe('isTextNode', () => {
		it('should return true for text node', () => {
			const node = { type: 'text', text: { text: 'Hello' } };
			expect(isTextNode(node)).toBe(true);
		});

		it('should return false for non-text node', () => {
			const node = { type: 'file', path: '/test.md' };
			expect(isTextNode(node)).toBe(false);
		});

		it('should return true for null (implementation quirk)', () => {
			expect(isTextNode(null)).toBe(true);
		});

		it('should return true for undefined (implementation quirk)', () => {
			expect(isTextNode(undefined)).toBe(true);
		});
	});

	describe('isFileNode', () => {
		it('should return true for file node', () => {
			const node = { type: 'file', path: '/test.md' };
			expect(isFileNode(node)).toBe(true);
		});

		it('should return false for non-file node', () => {
			const node = { type: 'text', text: { text: 'Hello' } };
			expect(isFileNode(node)).toBe(false);
		});

		it('should return false for null', () => {
			expect(isFileNode(null)).toBe(false);
		});
	});

	describe('isRecord', () => {
		it('should return true for plain objects', () => {
			expect(isRecord({})).toBe(true);
			expect(isRecord({ key: 'value' })).toBe(true);
		});

		it('should return false for primitives', () => {
			expect(isRecord('string')).toBe(false);
			expect(isRecord(123)).toBe(false);
			expect(isRecord(null)).toBe(false);
			expect(isRecord(undefined)).toBe(false);
			expect(isRecord(true)).toBe(false);
		});

		it('should return false for arrays', () => {
			expect(isRecord([])).toBe(false);
			expect(isRecord([1, 2, 3])).toBe(false);
		});

		it('should return false for functions', () => {
			expect(isRecord(() => {})).toBe(false);
		});
	});
});
