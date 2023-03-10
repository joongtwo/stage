// Copyright (c) 2022 Siemens

/**
 * @module js/explodeViewService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import viewerContextService from 'js/viewerContext.service';
import eventBus from 'js/eventBus';


var exports = {};

/**
 * Activates explode view mode
 *
 * @param {Object} viewerContextData Viewer context data
 */
export let toggleExplodeSubCommandsToolbar = function( viewerContextData ) {

    let isExplodeViewActive = viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE );
    if( isExplodeViewActive ) {
        viewerContextData.getMotionManager().disableExplodeView();
    } else {
        closeToolAndInfoCommand();
        viewerContextData.closeSubCommandsToolbar();
        viewerContextData.getMotionManager().startExplodeViewMode();
        viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE, true );
    }
};

/**
 * Close any other command panel that was open before explode command
 */
 export let closeToolAndInfoCommand = function() {
    var activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
    if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
        eventBus.publish( 'awsidenav.openClose', {
            id: 'aw_toolsAndInfo',
            commandId: activeToolAndInfoCmd.commandId
        } );
    }
};

/**
 * Reset Explode slider to initial value
 */
 export let resetExplodeSlider = function(explodeSliderProp) {
    var _explodeSliderProp = _.clone( explodeSliderProp );
    _explodeSliderProp.dbValue[ 0 ].sliderOption.value = 0;
    return _explodeSliderProp;
};

/**
 * Handle exploder view slider change event
 *
 * @function explodeSliderValChange
 *
 * @param {Object} viewerData this contains Viewer Context Data
 * @param {Number} sliderValue - new slider value
 */
 export let explodeSliderValChange = function( viewerContextData, sliderValue ) {
    viewerContextData.getMotionManager().setExplodeViewPercent(sliderValue);
};

export default exports = {
    toggleExplodeSubCommandsToolbar,
    resetExplodeSlider,
    explodeSliderValChange
};
