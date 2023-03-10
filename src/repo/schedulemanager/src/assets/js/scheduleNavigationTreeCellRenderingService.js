// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationTreeCellRenderingService
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import tcSessionData from 'js/TcSessionData';
import viewModelService from 'js/viewModelService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import tableSvc from 'js/published/splmTablePublishedService';

let exports;

/**
 * This method is used for creating customize cell commands of tree navigation column
 *
 * @param {Object} column - column Definition
 * @param {Object} vmo - View model object
 * @param {DOMElement} tableElem - table DOMElement as context
 * @returns {DOMElement} cellContent - tree cell command Element
 */
export let createTreeCellCommandElement = ( column, vmo, tableElem ) => {
    let scheduleObject = undefined;
    let cellContent = tableSvc.createTreeCellCommandElement( column, vmo, tableElem );
    let modelObject = cdm.getObject( vmo.uid );
    let userContext = appCtxSvc.getCtx( 'user' );
    let isScheduleTask = cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType );
    let isProxyTask = cmm.isInstanceOf( 'Fnd0ProxyTask', modelObject.modelType );
    // cell customization applied only for objects of which type either ScheduleTask or Fnd0ProxyTask
    if( isScheduleTask ) {
        scheduleObject = cdm.getObject( modelObject.props.schedule_tag.dbValues[ 0 ] );
    } else if( isProxyTask ) {
        scheduleObject = cdm.getObject( modelObject.props.fnd0schedule_tag.dbValues[ 0 ] );
    }
    if( scheduleObject && scheduleObject.props && scheduleObject.props.fnd0Schmgt_Lock && scheduleObject.props.fnd0Schmgt_Lock.dbValues[ 0 ] === userContext.uid ) {
        let cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
        if( isNewTaskCreatedInWhatIfMode( modelObject ) && cellText ) {
            cellText.classList.add( 'aw-schedulemanager-taskAddedInWhatIfMode' );
        } else if( isTaskModifiedInWhatIfMode( modelObject ) && cellText ) {
            cellText.classList.add( 'aw-schedulemanager-taskModifiedInWhatIfMode' );
        }
    }
    return cellContent;
};

/**
 * This method is used to update the whatIf properties after promoting changes
 * NOTE: This function is to load the 'fnd0Schmgt_Lock' of subschedules, as they are not loaded during Promote/Cancel changes
 * operation. This is fixed in TC13.2 and the below function can be removed when the minimum platform version is TC13.2.
 */
export let updateWhatIfProperties = ( dataProvider ) => {
    if( !isTCVersion132OrLater() ) {
        if( dataProvider ) {
            let vmNodes = dataProvider.viewModelCollection.loadedVMObjects;
            let updatedObjectListUids = [];
            if( vmNodes && vmNodes.length > 0 ) {
                _.forEach( vmNodes, function( vmNode ) {
                    let modelObject = cdm.getObject( vmNode.uid );
                    if( modelObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 && ( isNewTaskCreatedInWhatIfMode( modelObject ) ||
                            isTaskModifiedInWhatIfMode( modelObject ) ) ) {
                        updatedObjectListUids.push( modelObject.uid );
                        let scheduleObject = cdm.getObject( modelObject.props.schedule_tag.dbValues[ 0 ] );
                        // add schedule object to load 'fnd0Schmgt_Lock' properties
                        if( !updatedObjectListUids.includes( scheduleObject.uid ) ) {
                            updatedObjectListUids.push( scheduleObject.uid );
                        }
                    }
                } );
            }
            // load properties with updated values after promote command executed
            if( updatedObjectListUids && updatedObjectListUids.length > 0 ) {
                dms.getProperties( updatedObjectListUids, [ 'fnd0WhatIfMode', 'fnd0WhatIfData', 'fnd0Schmgt_Lock' ] );
            }
        }
    }
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
};

/**
 * Check if new task created in what If mode
 *
 * @param {Object} modelObject the model object
 * @return {Boolean} true or false
 */
let isNewTaskCreatedInWhatIfMode = function( modelObject ) {
    return modelObject && modelObject.props && modelObject.props.fnd0WhatIfMode && modelObject.props.fnd0WhatIfMode.dbValues[ 0 ] ===
        '1';
};
/**
 * Check if properties of existing task updated in what If mode
 *
 * @param {Object} modelObject the model object
 * @return {Boolean} true or false
 */
let isTaskModifiedInWhatIfMode = function( modelObject ) {
    return modelObject && modelObject.props && modelObject.props.fnd0WhatIfData && modelObject.props.fnd0WhatIfData.dbValues.length > 0;
};

/*
 * Get the supported TC version
 */
let isTCVersion132OrLater = function() {
    var isVersionSupported = false;
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();
    // If platform  is 13.2 or greater then return true
    if( tcMajor >= 13 && tcMinor >= 2 ) {
        isVersionSupported = true;
    }
    return isVersionSupported;
};

exports = {
    createTreeCellCommandElement,
    updateWhatIfProperties
};

export default exports;
