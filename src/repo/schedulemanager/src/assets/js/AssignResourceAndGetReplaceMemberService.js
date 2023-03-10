// Copyright (c) 2022 Siemens

/**
 * @module js/AssignResourceAndGetReplaceMemberService
 */
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';

var exports = {};

export let getAssignResourcePanel = function( commandId, location ) {
    var schedule = 'schedule';

    var selection = selectionService.getSelection().selected;

    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;

        var scheduleObj = {
            selectedObject: selection,
            scheduleTag: parent
        };

        appCtxService.registerCtx( schedule, scheduleObj );
    } else {
        appCtxService.unRegisterCtx( schedule );
    }

    commandPanelService.activateCommandPanel( commandId, location );
};

export let getReplaceMemberPanel = function( commandId, location ) {
    var schedule = 'schedule';
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;
        var jso;
        jso = {
            ScheduleMember: selection[ 0 ],
            selectedObject: parent
        };
        appCtxService.registerCtx( schedule, jso );
    } else {
        appCtxService.unRegisterCtx( schedule );
    }
    commandPanelService.activateCommandPanel( commandId, location );
};

export let getDesignateDisciplineToMembersPanel = function( commandId, location ) {
    var designateDiscInfo = 'designateDiscInfo';
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;
        var disciplineObj = soa_kernel_clientDataModel.getObject( selection[ 0 ].props.resource_tag.dbValues[ 0 ] );
        let context = {
            disciplineObj: disciplineObj,
            scheduleObj: parent
        };
        commandPanelService.activateCommandPanel( commandId, location, context );
    }
};

export let getUser = function() {
    var selection = selectionService.getSelection().selected;
    var userObj;
    if( selection && selection.length > 0 ) {
        userObj = soa_kernel_clientDataModel.getObject( selection[ 0 ].props.resource_tag.dbValues[ 0 ] );
    }
    return userObj;
};

exports = {
    getAssignResourcePanel,
    getReplaceMemberPanel,
    getDesignateDisciplineToMembersPanel,
    getUser
};

export default exports;
