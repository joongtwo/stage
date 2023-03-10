// Copyright (c) 2022 Siemens

/**
 * Module to provide the context menu service for SM Gantt.
 *
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/SMGantt/ganttContextMenuService
 */
import ganttManager from 'js/uiGanttManager';
import ngUtil from 'js/ngUtils';

var service = {};

var createContextMenu = function createContextMenu() {
    var html = '<aw-popup-command-bar anchor="saw1_ganttContextMenu" own-popup="false" close-on-click="true" ></aw-popup-command-bar>';
    var cellScope = {};
    cellScope.contextAnchor = 'aw_contextMenu2';
    return ngUtil.createNgElement( html, '', cellScope );
};

/**
 * Opens a pop-up(context) menu at the right-click location.
 *
 * @param {Event} event - the right click event
 * @param $scope {Object} - Directive scope
 */
export let showContextMenu = function( event, $scope ) {
    if( !event.target || event.which !== 3 /*hold and press touch event*/ ) {
        return;
    }

    var taskId = ganttManager.getGanttInstance().locate( event );

    if( !taskId || !ganttManager.getGanttInstance().getTask( taskId ) ) {
        return;
    }

    // D:\workdir\devunits\ba2\src\thinclient\ganttInterfacejs\src\js\aw-gantt.controller.js need to convert to component with popup
    // popupSvc.show( {
    //     domElement: createContextMenu(),
    //     context: $scope,
    //     options: {
    //         whenParentScrolls: 'close',
    //         targetEvent: event
    //     }
    // } );
};

export default service = {
    showContextMenu
};
