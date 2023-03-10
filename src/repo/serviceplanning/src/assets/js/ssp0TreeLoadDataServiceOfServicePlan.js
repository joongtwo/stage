// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to service plan tree
*
* @module js/ssp0TreeLoadDataServiceOfServicePlan
*/

import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import msgSvc from 'js/messagingService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import viewModelObjectService from 'js/viewModelObjectService';

let exports = {};
let alreadyLoaded = [];

const treeNodeMap = new Map();
const servicePlanTreeObjects = [ servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS, servicePlannerConstants.TYPE_SERVICE_CONTAINER_PROCESS,
    servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS, servicePlannerConstants.TYPE_WORK_CARD_PROCESS ];

/**
 * Reload the tree
 * @param {Object} dataProvider dataProvider
 */
export let reloadServicePlanTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        alreadyLoaded = [];
    }
    eventBus.publish( 'servicePlanTreeTable.plTable.reload' );
};

export let expandSelectedNode = function( nodeToBeExpanded, nodeToBeSelected, isForFirstLevel, dataProvider ) {
    if ( dataProvider !== null ) {
        let vmos;
        let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
        if( isForFirstLevel ) {
            vmos = [ vmoCollection[0] ];
        }else{
            vmos = vmoCollection.filter( obj => {
                return obj.uid === nodeToBeExpanded.uid;
            } );
        }
        if ( vmos && vmos.length === 1 ) {
            if ( !vmos[0].isExpanded ) {
                vmos[0].isExpanded = true;
                vmos[0].isLeaf = false;
                if( nodeToBeSelected ) {
                    const subscribeTreeNodesLoaded = eventBus.subscribe( 'servicePlanDataProvider.treeNodesLoaded', function( eventData ) {
                        let loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
                        let loadedObjectToToSelect = null;
                        if( nodeToBeExpanded.type === servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS && nodeToBeExpanded.type !== nodeToBeSelected.type ) {
                            loadedObjectToToSelect = loadedObjects[loadedObjects.length - 1];
                        }else{
                            loadedObjectToToSelect = loadedObjects.filter( loadedObj => loadedObj.uid === nodeToBeSelected.uid );
                        }
                        dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
                        eventBus.unsubscribe( subscribeTreeNodesLoaded );
                    } );
                }
                eventBus.publish( 'servicePlanTreeTable.plTable.toggleTreeNode', vmos[0] );
            }
        } else {
            // Log the errors
        }
    }
};

/**
 * Refresh the service plan tree
 * @param {Object} dataProvider dataProvider
 */
export let refreshServicePlanTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        alreadyLoaded = [];
    }

    eventBus.publish( 'servicePlanTreeTable.plTable.refreshClient' );
};


/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadServicePlanTreeTableColumns = function( data ) {
    const localizeDisplayName = data.grids.servicePlanTreeTable.i18n;
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    const zerothColumnConfigCol = {
        name: 'graphicVisibility',
        width: 30,
        enableFiltering: false,
        enableColumnResizing: true,
        pinnedLeft: true,
        columnOrder: 90
    };
    const firstColumnConfigCol = {
        name: 'bl_item_object_name',
        displayName: localizeDisplayName.nameValueColumn,
        width: 285,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true
    };
    const secondColumnConfigCol = {
        name: 'bl_item_item_id',
        displayName: localizeDisplayName.idValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    const thirdColumnConfigCol = {
        name: 'bl_item_object_desc',
        displayName: localizeDisplayName.descriptionValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    awColumnInfos.push( zerothColumnConfigCol );
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos.push( thirdColumnConfigCol );
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
 * Save VMO in ctx
 * @param {Object} vmo view model object
 */
export let saveVMOInCtx = function( vmo ) {
    if ( vmo ) {
        if ( !appCtxSvc.ctx.selectedVMO ) {
            appCtxSvc.registerCtx( 'selectedVMO', vmo );
        }
        if ( vmo.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS ) ||
                 vmo.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_WORK_CARD_PROCESS ) ) {
            eventBus.publish( 'Ssp0Parts.triggerFunction', { selectedObj: vmo } );
        }
        appCtxSvc.updateCtx( 'selectedVMO', vmo );
        eventBus.publish( 'partsTree.plTable.reload' );
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
 * Get child nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} parentNode parentNode of Tree
 * @return {Array.Object} Array of modelObjects
 */
export let getChildNodes = function( response, parentNode ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    if ( modelObjects ) {
        let parentObject = Object.values( modelObjects ).filter( modelObject =>modelObject.uid === parentNode.uid && modelObject.props.bl_child_lines )[0];
        if( parentObject ) {
            found = true;
            const objects = parentObject.props.bl_child_lines.dbValues;
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
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} nodeBeingExpanded nodeBeingExpanded of Tree
 * @param {Object} data data
 * @return {Object} TreeLoadResult of node
 */
export let setNodeProperties = function( response, nodeBeingExpanded, data ) {
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    const plain = response.plain;
    let objectsToReturn = [];
    if ( modelObjects ) {
        Object.values( modelObjects ).filter( modelObject =>
            plain.includes( modelObject.uid ) && servicePlanTreeObjects.includes( modelObject.type ) && modelObject.props && modelObject.props.bl_item_object_name &&
            !modelObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_PART_PROCESS ) ).forEach(
            modelObject =>{
                let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObject, 'create' );
                if ( modelObject.props.bl_item_object_name ) {
                    vmo.displayName = modelObject.props.bl_item_object_name.dbValues[0];
                    vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                    vmo.underlyingObjectType = modelObject.type;
                    vmo.isVisible = false;
                }
                vmo.isLeaf = _checkIfLeaf( modelObject );
                vmo.alreadyExpanded = false;
                objectsToReturn.push( vmo );
                if ( modelObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS ) ) {
                    saveVMOInCtx( vmo );
                    vmo.servicePartitionUid = data.sourceContextUid.servicePartitionUid;
                }
            } );
    }
    if ( objectsToReturn.length === 0 ) {
        nodeBeingExpanded.isLeaf = true;
    }
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

let _checkIfLeaf = function( modelObject ) {
    if ( modelObject.props.bl_quick_num_children && modelObject.props.Mfg0all_material ) {
        const childCount = parseInt( modelObject.props.bl_quick_num_children.dbValues[0], 10 ); // Converting String to num.. Used 10 for base 10 values
        return childCount === 0 || childCount === modelObject.props.Mfg0all_material.dbValues.length;
    }
    return modelObject.props.bl_has_children.dbValues[0] === '0';
};

/**
 * Get source context uid
 * @param {Object} response response of SOA
 * @return {Object} Object contains uid of service plan and service partition
 */
export let getSourceContextUid = function( response ) {
    return {
        servicePartitionUid: response.output[0].contexts[0].views[0].uid,
        servicePlanUid: response.output[0].contexts[0].context.uid
    };
};

/**
 * If response contains errors show them else trigger the event to consume parts
 * @param {Object} response response of SOA
 */
export let consumeAndLoadParts = function( response ) {
    if ( response ) {
        if ( response.ServiceData.partialErrors && response.ServiceData.partialErrors[0] && response.ServiceData.partialErrors[0].errorValues ) {
            response.ServiceData.partialErrors[0].errorValues.forEach( errorValue => {
                msgSvc.showError( errorValue.message );
            } );
        } else {
            eventBus.publish( 'Ssp0Parts.triggerFunction', { selectedObj: appCtxSvc.getCtx( 'selectedVMO' ) } );
        }
    }
};


/**
 * If response contains errors show them else trigger the event to consume parts
 * @param {Object} nodeBeingExpanded nodeBeingExpanded
 * @return {Array} array of uid
 */
export let getNodesUids = function( nodeBeingExpanded ) {
    let a = nodeBeingExpanded.props.bl_child_lines.dbValue;
    let uids = [];
    a.forEach( element => {
        uids.push( { uid: element } );
    } );
    return uids;
};


/**
 * It returns the array of default occurrence types
 * @param {String} sourceObjectsLength length of parts source objects
 * @return {Array} array of default occurrence types
 */
export let getStringArrayProps = function( sourceObjectsLength ) {
    return new Array( sourceObjectsLength ).fill( servicePlannerConstants.TYPE_OCCURRENCE );
};

export let subscribeToNodesLoaded = function( ) {
    const subscribeTreeNodesLoaded = eventBus.subscribe( 'servicePlanDataProvider.treeNodesLoaded', function( eventData ) {
        eventBus.publish( 'expandSelectedNode', {
            isForFirstLevel: true
        } );
        eventBus.unsubscribe( subscribeTreeNodesLoaded );
    } );
};

export default exports = {
    subscribeToNodesLoaded,
    getStringArrayProps,
    getNodesUids,
    consumeAndLoadParts,
    getSourceContextUid,
    getChildNodes,
    setNodeProperties,
    retrieveTreeLoadResult,
    saveVMOInCtx,
    loadServicePlanTreeTableColumns,
    reloadServicePlanTree,
    refreshServicePlanTree,
    expandSelectedNode
};
