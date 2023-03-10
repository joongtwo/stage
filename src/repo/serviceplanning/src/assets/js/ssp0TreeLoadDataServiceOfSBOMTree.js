// Copyright (c) 2022 Siemens

/**
* Service for loading tree data of SBOM
*
* @module js/ssp0TreeLoadDataServiceOfSBOMTree
*/
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awTableService from 'js/awTableService';
import cdmService from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import parsingUtils from 'js/parsingUtils';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';

let exports = {};
let alreadyLoaded = [];
const treeNodeMap = new Map();
const IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
 * Get a page of row column data for a tree-table.
 * @param {Object} dataProvider dataProvider
 * @param {String} gridId grid Id
 * @param {Array} vmNodes array of visible view model object
 * @param {Object} context Context
 * @return {promise} an promise resolves
 */
export let loadTreeTableProperties = function( dataProvider, gridId, vmNodes, context ) {
    let currentVmNodes = [];
    _.forEach( vmNodes, function( vmNode ) {
        if ( !alreadyLoaded.some( loadedNode => loadedNode.uid === vmNode.uid ) ) {
            currentVmNodes.push( vmNode );
        }
    } );
    if ( currentVmNodes.length > 0 ) {
        return new Promise( function( resolve, reject ) {
            resolve( _loadProperties( dataProvider, gridId, currentVmNodes, context ) );
        } );
    }
    const propertyLoadResult = awTableService.createPropertyLoadResult( currentVmNodes );
    return {
        propertyLoadResult: propertyLoadResult
    };
};

/**
 * Initial call for getting a page of row column data for a tree-table.
 * @param {Object} dataProvider dataProvider
 * @param {String} gridId grid Id
 * @param {Array} vmNodes array of visible view model object
 * @param {Object} context Context
 * @return {promise} an promise resolves
 */
export let initialLoadTreeTableProperties = function( dataProvider, gridId, vmNodes, context ) {
    dataProvider.columnConfigLoadingInProgress = true;
    let currentVmNodes = [];
    let loadVMOPropsThreshold = 0;
    _.forEach( vmNodes, function( vmNode ) {
        if ( !vmNode.props ) {
            vmNode.props = {};
        }
        if ( !alreadyLoaded.some( loadedNode => loadedNode.uid === vmNode.uid ) && loadVMOPropsThreshold <= 50 ) {
            currentVmNodes.push( vmNode );
            loadVMOPropsThreshold++;
        }
    } );
    if ( currentVmNodes.length > 0 ) {
        return new Promise( function( resolve, reject ) {
            resolve( _loadProperties( dataProvider, gridId, currentVmNodes, context ) );
        } );
    }
    const propertyLoadResult = awTableService.createPropertyLoadResult( currentVmNodes );
    return {
        propertyLoadResult: propertyLoadResult
    };
};

/**
 * Initial call for getting a page of row column data for a tree-table.
 * @param {Object} dataProvider dataProvider
 * @param {String} gridId grid Id
 * @param {Array} vmNodes array of visible view model object
 * @param {Object} context Context
 * @return {Object} propertyLoadResult
 */
function _loadProperties( dataProvider, gridId, vmNodes, context ) {
    let allChildNodes = [];
    alreadyLoaded.push( ...vmNodes );

    _.forEach( vmNodes, function( vmNode ) {
        if ( !vmNode.props || !_.size( vmNode.props ) ) {
            vmNode.props = {};
        }
        allChildNodes.push( vmNode );
    } );

    let propertyLoadResult = awTableService.createPropertyLoadResult( allChildNodes );
    propertyLoadResult.columnConfig = dataProvider.columnConfig;

    const resolutionObj = {
        propertyLoadResult: propertyLoadResult
    };
    if ( allChildNodes.length > 0 ) {
        return tcVmoService.getTableViewModelProperties( allChildNodes, context ).then(
            function() {
                eventBus.publish( gridId + '.plTable.clientRefresh' );
            } ).then(
            function() {
                return resolutionObj;
            }
        );
    }

    return resolutionObj;
}

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @param {Object} columnProvider columnProvider
 * @return {Promise} deferred promise
 */
export let loadTreeTableColumns = function( data, columnProvider ) {
    const localizeDisplayName = data.grids.sbomTree.i18n;
    const zerothColumnConfigCol = {
        name: 'graphicVisibility',
        width: 30,
        enableFiltering: false,
        enableColumnResizing: true,
        pinnedLeft: true,
        columnOrder: 90
    };
    const firstColumnConfigCol = {
        name: 'object_string',
        displayName: localizeDisplayName.elementValueColumn,
        typeName: 'Awb0Element',
        width: 285,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true,
        columnOrder: 100
    };
    const secondColumnConfigCol = {
        name: 'awb0ArchetypeId',
        displayName: localizeDisplayName.idValueColumn,
        typeName: 'Awb0ConditionalElement',
        minWidth: 100,
        width: 100,
        enableColumnMenu: false,
        enableColumnMoving: false,

        columnOrder: 110
    };
    const thirdColumnConfigCol = {
        name: 'awb0ArchetypeRevOwningUser',
        displayName: localizeDisplayName.ownerValueColumn,
        typeName: 'Awb0ConditionalElement',
        minWidth: 100,
        width: 100,
        enableColumnMenu: false,
        enableColumnMoving: false,

        columnOrder: 140
    };
    const fourthColumnConfigCol = {
        name: 'awb0ArchetypeRevName',
        displayName: localizeDisplayName.revisionNameValueColumn,
        typeName: 'Awb0ConditionalElement',
        minWidth: 100,
        width: 100,
        enableColumnMenu: false,
        enableColumnMoving: false,

        columnOrder: 130
    };
    const fifthColumnConfigCol = {
        name: 'awb0ArchetypeRevId',
        displayName: localizeDisplayName.revisionValueColumn,
        typeName: 'Awb0ConditionalElement',
        minWidth: 100,
        width: 100,
        enableColumnMenu: false,
        enableColumnMoving: false,

        columnOrder: 120
    };
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    let clientColumns = columnProvider && columnProvider.clientColumns ? columnProvider.clientColumns : [];
    if ( clientColumns ) {
        _.forEach( clientColumns, function( column ) {
            if ( column.clientColumn ) {
                awColumnInfos.push( column );
            }
        } );
    }
    awColumnInfos.push( zerothColumnConfigCol );
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos.push( thirdColumnConfigCol );
    awColumnInfos.push( fourthColumnConfigCol );
    awColumnInfos.push( fifthColumnConfigCol );
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
 * Extracts the view model properties from response and updates the corresponding viewmodelObject
 *
 * @param {ViewModelObject[]} viewModelObjects - view model object to update.
 * @param {Object} response - response
 */
function processViewModelObjectsFromJsonResponse( viewModelObjects, response ) {
    // update the view model object with the view model properties.
    if ( response.viewModelJSON && !response.viewModelPropertiesJsonString ) {
        // remove after SOA is updated
        response.viewModelPropertiesJsonString = response.viewModelJSON;
    }

    if ( response && response.viewModelPropertiesJsonString ) {
        const responseObject = parsingUtils.parseJsonString( response.viewModelPropertiesJsonString );
        const objectsInResponse = responseObject.objects;

        _.forEach( viewModelObjects, function( viewModelObject ) {
            let objectUpdated = false;
            if ( viewModelObject ) {
                _.forEach( objectsInResponse, function( currentObject ) {
                    if ( !objectUpdated && currentObject && currentObject.uid === viewModelObject.uid ) {
                        exports.mergeObjects( viewModelObject, currentObject );
                        objectUpdated = true;
                    }
                } );
            }
        } );
    }
}

/**
 * Merges the properties of a view model object and either another view model object, or a server view model object
 * from the SOA response.
 *
 * @param {ViewModelObject} targetViewModelObject - target object to merge to.
 * @param {ViewModelObject|Object} sourceViewModelObject - source object to merge values (overrides target values)
 */
export let mergeObjects = function( targetViewModelObject, sourceViewModelObject ) {
    let responseViewModelObject = sourceViewModelObject;

    if ( !viewModelObjectSvc.isViewModelObject( sourceViewModelObject ) ) {
        responseViewModelObject = viewModelObjectSvc.createViewModelObject( sourceViewModelObject.uid, 'EDIT', null, sourceViewModelObject );
    }

    let visible = targetViewModelObject.visible;
    _.merge( targetViewModelObject, responseViewModelObject );
    targetViewModelObject.visible = visible;
};

/**
 * Reset the Tree Properties
 * @param {Object} dataProvider dataProvider
 */
let resetTreeProps = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        alreadyLoaded = [];
    }
};

/**
 * Get a page of row column data for a tree-table.
 * @param {Object} response response of SOA
 * @param {String} nodeBeingExpanded Node being expanded
 * @param {Array} ctx ctx
 * @param {Object} dataProvider dataProvider
 * @return {Object} TreeLoadResult of node
 */
export let setParentNodeProperties = function( response, nodeBeingExpanded, ctx, dataProvider ) {
    resetTreeProps( dataProvider );
    if ( response.rootProductContext ) {
        appCtxSvc.registerCtx( 'sbomProductContext', response.rootProductContext );
    }
    const modelObjects = response.parentChildrenInfos[0].parentInfo || response.data.parentChildrenInfos[0].parentInfo;
    let objectsToReturn = [];
    if ( modelObjects ) {
        const modelObjectJson = modelObjects;
        if ( cdmService.isValidObjectUid( modelObjectJson.occurrenceId ) ) {
            let vmo = getObject( modelObjectJson.occurrenceId );
            if ( modelObjectJson ) {
                vmo.displayName = modelObjectJson.displayName;
                vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                vmo.isVisible = false;
                vmo.isExpanded = false;
                vmo.isLeaf = modelObjectJson.numberOfChildren === 0;
            }
            vmo.alreadyExpanded = false;
            objectsToReturn.push( vmo );
        }
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

/**
 * Get neutral Product Uid.
 * @param {Object} response response of SOA
 * @return {String} uid
 */
export let getNeutralProductUid = function( response ) {
    let uid = '';
    if ( response && response.output[0] ) {
        uid = response.output[0].relationshipData[0].relationshipObjects[0].otherSideObject.uid;
    }
    return uid;
};

/**
 * Get a page of row column data for a tree-table.
 * @param {Object} response response of SOA
 * @param {String} nodeBeingExpanded Node being expanded
 * @return {Object} TreeLoadResult of node
 */
export let setChildNodeProperties = function( response, nodeBeingExpanded ) {
    const modelObjects = response.parentChildrenInfos[0].childrenInfo || response.data.parentChildrenInfos[0].childrenInfo;
    let objectsToReturn = [];
    if ( modelObjects ) {
        Object.values( modelObjects ).filter( modelObject => modelObject.displayName && modelObject.occurrenceId ).forEach( modelObject => {
            if ( cdmService.isValidObjectUid( modelObject.occurrenceId ) ) {
                let vmo = getObject( modelObject.occurrenceId );

                if ( modelObject ) {
                    vmo.displayName = modelObject.displayName;
                    if ( vmo.type === 'unknownType' ) {
                        vmo.type = modelObject.underlyingObjectType;
                    }
                    vmo.uid = modelObject.occurrenceId;
                    vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                    vmo.isVisible = false;
                    vmo.isLeaf = modelObject.numberOfChildren === 0;
                }
                vmo.props = {};
                vmo.alreadyExpanded = false;
                objectsToReturn.push( vmo );
            }
        } );
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

/**
 * Get Tree Load Result of parent node
 * @param {Object} parentNode parentnode of tree
 * @return {Object} TreeLoadResult of node
 */
export let retrieveTreeLoadResult = function( parentNode ) {
    if ( !parentNode.uid ) {
        parentNode = parentNode.parentNode;
    }

    if ( parentNode.totalChildCount !== null ) {
        let tem = treeNodeMap.get( parentNode.uid ).parentNode;
        tem.children = [];
        tem.totalChildCount = null;
        return tem;
    }

    if ( treeNodeMap.has( parentNode.uid ) ) {
        return treeNodeMap.get( parentNode.uid );
    }
};

/**
* Get Model object of given uid.
* @param {String} uid uid of object
* @return {Object} IModelObject
*/
export let getObject = function( uid ) {
    if ( cdmService.isValidObjectUid( uid ) ) {
        const obj = cdmService.getObject( uid );

        if ( !obj ) {
            return new IModelObject( uid, 'unknownType' );
        }

        return obj;
    }

    return new IModelObject( cdmService.NULL_UID, 'unknownType' );
};

/**
* Get Uid of Service Plan Object
* @param {Object} response response
* @return {Object} IModelObject
*/
export let getServicePlanID = function( response ) {
    const modelObjects = response.modelObjects;
    if ( modelObjects ) {
        let servicePlanUid = '';
        Object.values( modelObjects ).filter( modelObject => modelObject.props.items_tag ).forEach( modelObject => {
            servicePlanUid = modelObject.props.items_tag.dbValues[0];
        } );
        return {
            uid: servicePlanUid,
            type: 'SSP0ServicePlan'

        };
    }
};

export let subscribeToNodesLoaded = function(  ) {
    const subscribeTreeNodesLoaded = eventBus.subscribe( 'sbomTreeDataProvider.treeNodesLoaded', function( eventData ) {
        eventBus.publish( 'SBOMTree.expandSelectedNode', {} );
        eventBus.unsubscribe( subscribeTreeNodesLoaded );
    } );
};

export let expandSelectedNode = function( dataProvider ) {
    if ( dataProvider !== null ) {
        let vmo;
        let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
        vmo = vmoCollection[0];
        if ( vmo ) {
            if ( !vmo.isExpanded && !vmo.isLeaf ) {
                vmo.isExpanded = true;
                vmo.isLeaf = false;
                eventBus.publish( 'sbomTree.plTable.toggleTreeNode', vmo );
            }
        } else {
            // Log the errors
        }
    }
};

export default exports = {
    expandSelectedNode,
    subscribeToNodesLoaded,
    getServicePlanID,
    retrieveTreeLoadResult,
    setChildNodeProperties,
    getNeutralProductUid,
    setParentNodeProperties,
    loadTreeTableColumns,
    loadTreeTableProperties,
    mergeObjects,
    initialLoadTreeTableProperties,
    processViewModelObjectsFromJsonResponse
};
