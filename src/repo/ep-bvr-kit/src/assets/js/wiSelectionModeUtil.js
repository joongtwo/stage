// Copyright (c) 2020 Siemens

/**
 * @module js/wiSelectionModeUtil
 */
import appCtxSvc from 'js/appCtxService';


const EP_WI_SELECTION_MODE = 'epWiSelectionMode';
const SELECTION_MODE_EDITOR = 'EDITOR';
const SELECTION_MODE_VIEWER = 'GRAPHICS';

/**
 * toggle Selection Mode
 */
export function toggleSelectionMode( ) {
    let selectionMode = appCtxSvc.getCtx( EP_WI_SELECTION_MODE );
    selectionMode = selectionMode === SELECTION_MODE_EDITOR ? SELECTION_MODE_VIEWER : SELECTION_MODE_EDITOR;
    appCtxSvc.updatePartialCtx( EP_WI_SELECTION_MODE, selectionMode );
}

/**
 * initialize the context with the default value of the toggle.
 */
export function initializeSelectionMode() {
    appCtxSvc.updatePartialCtx( EP_WI_SELECTION_MODE, SELECTION_MODE_EDITOR );
}

/**
 * unRegister Selection Mode
 */
export function unRegisterSelectionMode() {
    appCtxSvc.unRegisterCtx( EP_WI_SELECTION_MODE );
}

const exports = {
    toggleSelectionMode,
    initializeSelectionMode,
    unRegisterSelectionMode
};

export default exports;
