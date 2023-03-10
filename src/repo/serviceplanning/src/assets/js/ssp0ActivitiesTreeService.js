// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to activities tree
*
* @module js/ssp0ActivitiesTreeService
*/

import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import { getBaseUrlPath } from 'app';
import { constants as timeAnalysisConstants } from 'js/ssp0TimeAnalysisConstants';
import viewModelObjectService from 'js/viewModelObjectService';

let exports = {};
const treeNodeMap = new Map();


/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} nodeBeingExpanded nodeBeingExpanded of Tree
 * @return {Object} TreeLoadResult of node
 */
export let setActivityNodeProperties = function( response, nodeBeingExpanded ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let iterableModelObjects = [];
    if ( nodeBeingExpanded.props ) {
        _handleEditStates( nodeBeingExpanded, 'al_activity_time_system_unit_time' );
        _handleEditStates( nodeBeingExpanded, 'al_activity_time_system_category' );
        nodeBeingExpanded.props.al_activity_time_system_unit_time.uiValue = '';
        let imagePath = getBaseUrlPath() + '/image/typeTimeActivity48.svg';
        nodeBeingExpanded.typeIconURL = imagePath;
        iterableModelObjects = nodeBeingExpanded.props.me_cl_child_lines.dbValues;
    } else {
        iterableModelObjects = modelObjects[nodeBeingExpanded.uid].props.bl_me_activity_lines.dbValues;
    }

    let objectsToReturn = [];

    iterableModelObjects.forEach(
        key => {
            if ( modelObjects && modelObjects[key].props && modelObjects[key].props.me_cl_display_string &&
                modelObjects[key].modelType.typeHierarchyArray.includes( timeAnalysisConstants.TYPE_Activity_Line ) ) {
                let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObjects[key], 'create' );
                vmo.displayName = modelObjects[key].props.me_cl_display_string.dbValues[0];
                vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                vmo.underlyingObjectType = modelObjects[key].type;
                vmo.isVisible = false;
                vmo.isLeaf = modelObjects[key].props.al_activity_awp0HasChildren.dbValues[0] !== 'True';
                if ( !vmo.isLeaf ) {
                    _handleEditStates( vmo, 'al_activity_time_system_unit_time' );
                    _handleEditStates( vmo, 'al_activity_time_system_category' );
                    vmo.props.al_activity_time_system_unit_time.uiValue = '';
                }
                let imagePath = getBaseUrlPath() + '/image/typeTimeActivity48.svg';
                vmo.typeIconURL = imagePath;
                vmo.alreadyExpanded = false;
                objectsToReturn.push( vmo );
            }
        } );
    const treeLoadResult = {
        parentNode: nodeBeingExpanded,
        childNodes: objectsToReturn,
        totalChildCount: objectsToReturn.length,
        startChildNdx: 0

    };
    nodeBeingExpanded.alreadyExpanded = true;
    treeNodeMap.set( nodeBeingExpanded.uid, treeLoadResult );

    return treeNodeMap.get( nodeBeingExpanded.uid );
};

let _handleEditStates = function( vmo, propertyName ) {
    vmo.props[propertyName].isPropertyModifiable = false;
};

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadActivitiesTableColumns = function( data ) {
    const localizeDisplayName = data.grids.activitiesTreeTable.i18n;
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    const firstColumnConfigCol = {
        name: 'me_cl_display_string',
        displayName: localizeDisplayName.nameValueColumn,
        width: 400,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true
    };
    const secondColumnConfigCol = {
        name: 'al_activity_long_description',
        displayName: localizeDisplayName.descriptionValueColumn,
        width: 350,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const thirdColumnConfigCol = {
        name: 'al_activity_time_system_code',
        displayName: localizeDisplayName.codeValueColumn,
        width: 235,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const fourthColumnConfigCol = {
        name: 'al_activity_time_system_unit_time',
        displayName: localizeDisplayName.unitTimeValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const fifthColumnConfigCol = {
        name: 'al_activity_Mfg0quantity',
        displayName: localizeDisplayName.quantityValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const sixthColumnConfigCol = {
        name: 'al_activity_time_system_frequency',
        displayName: localizeDisplayName.frequencyValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const seventhColumnConfigCol = {
        name: 'al_activity_work_time',
        displayName: localizeDisplayName.workTimeValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const eightthColumnConfigCol = {
        name: 'al_activity_time_system_category',
        displayName: localizeDisplayName.categoryValueColumn,
        minWidth: 100,
        width: 150,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const ninethColumnConfigCol = {
        name: 'al_activity_ssp0ActivityExecutionType',
        displayName: localizeDisplayName.executionTypeValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos.push( thirdColumnConfigCol );
    awColumnInfos.push( fourthColumnConfigCol );
    awColumnInfos.push( fifthColumnConfigCol );
    awColumnInfos.push( sixthColumnConfigCol );
    awColumnInfos.push( seventhColumnConfigCol );
    awColumnInfos.push( eightthColumnConfigCol );
    awColumnInfos.push( ninethColumnConfigCol );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );

    return deferred.promise;
};

/**
 * Get child nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} parentNode parentNode of Tree
 * @return {Array.Object} Array of modelObjects
 */
export let getChildNodesOfActivity = function( response, parentNode ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    if ( modelObjects ) {
        let parentObject = Object.values( modelObjects ).filter( modelObject => modelObject.uid === parentNode.uid && modelObject.props.me_cl_child_lines )[0];
        if ( parentObject ) {
            found = true;
            const objects = parentObject.props.me_cl_child_lines.dbValues;
            const input = [];
            objects.forEach( o => input.push( {
                uid: o
            } ) );
            return input;
        }
    }
    if ( !found ) {
        return [];
    }
};

/**
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let selectionChanged = function( vmo ) {
    if ( vmo !== undefined ) {
        if ( !appCtxSvc.ctx.selectedActivity ) {
            appCtxSvc.registerCtx( 'selectedActivity', vmo );
        }
        appCtxSvc.updateCtx( 'selectedActivity', vmo );
    } else {
        appCtxSvc.unRegisterCtx( 'selectedActivity' );
    }
};

/**
 * Reload the tree
 * @param {Object} dataProvider dataProvider
 */
export let reloadActivitiesTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        eventBus.publish( 'activitiesTreeTable.plTable.reload' );
    }
};

/**
 * Get Tree Load Result of parent node
 * @param {Object} parentNode response of SOA
 * @return {Object} TreeLoadResult of node
 */
export let retrieveTreeLoadResult = function( parentNode ) {
    if ( !parentNode.uid ) {
        parentNode = parentNode.parentNode;
    }
    if ( treeNodeMap.has( parentNode.uid ) ) {
        return treeNodeMap.get( parentNode.uid );
    }
};

/**
 * Edit the table
 */
export let startEditTable = function() {
    //Start editing the table
};

export default exports = {
    startEditTable,
    retrieveTreeLoadResult,
    reloadActivitiesTree,
    selectionChanged,
    getChildNodesOfActivity,
    setActivityNodeProperties,
    loadActivitiesTableColumns
};
