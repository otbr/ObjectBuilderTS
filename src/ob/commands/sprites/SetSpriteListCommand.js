"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.SetSpriteListCommand = void 0;
const WorkerCommand_1 = require("../../../workers/WorkerCommand");
class SetSpriteListCommand extends WorkerCommand_1.WorkerCommand {
    constructor(selectedIds, sprites, totalCount, minId, maxId, currentMin, currentMax) {
        super();
        this.selectedIds = selectedIds;
        this.sprites = sprites;
        this.totalCount = totalCount;
        this.minId = minId;
        this.maxId = maxId;
        this.currentMin = currentMin;
        this.currentMax = currentMax;
    }
}
exports.SetSpriteListCommand = SetSpriteListCommand;
