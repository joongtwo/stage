// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/PlanNavigationTreeUtils
 */

import _ from 'lodash';
import appCtx from 'js/appCtxService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import selectionSvc from 'js/selection.service';
import _cdm from 'soa/kernel/clientDataModel';

let exports;
let policyId;

/**
 * Returns the first element matching the given attribute.
 *
 * @param {Array} elements elements to find a match from
 * @param {String} attrName attribute name to match
 * @param {String} attrValue attribute value to match
 * @returns {object} matching element
 */
let getFirstMatchingElement = ( elements, attrName, attrValue ) => {
    let matchingElement = null;
    for( var i = 0; i < elements.length; ++i ) {
        let attr = elements[ i ].getAttribute( attrName );
        if( attr && attr === attrValue ) {
            matchingElement = elements[ i ];
            break;
        }
    }

    return matchingElement;
};

/**
 * @returns {object} Plan Navigation tree table
 */
export let getPlanNavigationTreeTableElement = () => {
    return document.getElementById( 'planNavigationTree' );
};

/**
 * @returns {object} Plan Navigation tree table
 */
export let getProgramBoardElement = () => {
    let includeElements = document.getElementsByTagName( 'aw-include' );
    return getFirstMatchingElement( includeElements, 'view-id', 'programBoardView' );
};

/**
 * @returns {object} Plan Navigation Timeline
 */
export let getPlanNavigationTimelineElement = () => {
    let timelineElement;
    let timelineWrapper = document.getElementsByClassName('prgTimeline');
    if( timelineWrapper && timelineWrapper.length > 0) {
        timelineElement = timelineWrapper[0];
    }
    return timelineElement;
};

/**
 * Returns the root node (Program) in the tree.
 * This returns the ViewModelTreeeNode object and NOT ViewModelObject.
 * @returns {Object} The root view model tree node.
 */
export let getRootTreeNode = () => {
    let timelineCotext = appCtx.getCtx('timelineContext');
    let treeDataProvider = timelineCotext.treeDataProvider;
    let rootTreeNode = treeDataProvider.viewModelCollection.loadedVMObjects[ 0 ];
    return rootTreeNode;
};

/**
 * Determines if the current sublocation is Schedule navigation sublocation
 *
 * @returns {boolean} true, if the current sublocation is Schedule navigation sublocation; false otherwise.
 */
export let isPlanNavigationSublocation = () => {
    return appCtx.ctx.locationContext &&
        appCtx.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.prgplanning:PlanNavigationSubLocation';
};

/**
 * Returns the UIDs of the given tree nodes.
 *
 * @param {Array} treeNodes view model tree nodes
 * @returns {Array} Uids uids of the tree nodes
 */
export let getUidsOfTreeNodes = ( treeNodes ) => {
    let uids = [];
    if( Array.isArray( treeNodes ) ) {
        treeNodes.forEach( ( node ) => {
            uids.push( node.uid );
        } );
    }

    return uids;
};

export let updateSelectionForSecondary = ( data ) => {
    if( !_.isEmpty( data.eventData ) ) {
        // this check added - in case of deletion of Milestone from timeline, data.eventData just contains Uid of context
        if( data.eventData.uid === undefined ) {
            data.eventData = _cdm.getObject( data.eventData );
        }
        data.dataProviders.planNavigationTreeDataProvider.selectionModel.selectNone();
    }
};

export let loadEventProperties = () => {
    let preferences = appCtx.ctx.preferences.PP_Event_Information;
    let properties = [];

    if( preferences && preferences.length > 0 ) {
        preferences.forEach( pref => {
            let prefName = {};
            prefName.name = pref;
            properties.push( prefName );
        } );
    }
    preferences = appCtx.ctx.preferences.PP_Event_Tooltip_Information;
    if( preferences && preferences.length > 0 ) {
        preferences.forEach( pref => {
            let prefName = {};
            prefName.name = pref;
            properties.push( prefName );
        } );
    }

    if( properties.length > 0 ) {
        policyId = propertyPolicySvc.register( {
            types: [ {
                name: 'Prg0AbsEvent',
                properties: properties
            } ]
        } );
    }
    let timelineContext = {};
    timelineContext.propertyNames = {};
    appCtx.registerCtx( 'timelineContext', timelineContext );
};

export let unloadEventProperties = () => {
    propertyPolicySvc.unregister( policyId );
};

export let selectEventOnSelectionService = ( eventData ) => {
    if( eventData && eventData.vmo && eventData.vmo.modelType ) {
        selectionSvc.updateSelection( eventData.vmo, appCtx.getCtx( 'locationContext.modelObject' ) );
    }
};

exports = {
    getPlanNavigationTreeTableElement,
    getProgramBoardElement,
    getPlanNavigationTimelineElement,
    getRootTreeNode,
    isPlanNavigationSublocation,
    updateSelectionForSecondary,
    loadEventProperties,
    unloadEventProperties,
    selectEventOnSelectionService
};

export default exports;
