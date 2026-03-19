/**
 * Command history — pure command pattern (no state snapshots).
 * Each command: { execute(), undo() }
 * Max 20 undoable steps.
 */
const MAX = 20;
let stack = [];
let ptr = -1;

export const commandHistory = {
    execute(cmd) {
        // discard any future branch
        stack = stack.slice(0, ptr + 1);
        cmd.execute();
        stack.push(cmd);
        if (stack.length > MAX) stack.shift();
        ptr = stack.length - 1;
    },
    undo() {
        if (ptr < 0) return;
        stack[ptr].undo();
        ptr--;
    },
    redo() {
        if (ptr >= stack.length - 1) return;
        ptr++;
        stack[ptr].execute();
    },
    canUndo: () => ptr >= 0,
    canRedo: () => ptr < stack.length - 1,
};