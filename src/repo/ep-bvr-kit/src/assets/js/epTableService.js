// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for ep table views
 *
 * @module js/epTableService
 */
import _ from 'lodash';
import epSaveService from 'js/epSaveService';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import policySvc from 'soa/kernel/propertyPolicyService';
import saveInputWriterService from 'js/saveInputWriterService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import awTableService from 'js/awTableService';
import mfeTableService from 'js/mfeTableService';
import viewModelObjectService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import mfeSyncUtils from 'js/mfeSyncUtils';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import awPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import mfeFilterAndSortService from 'js/mfeFilterAndSortService';
import mfeContentPanelUtil from 'js/mfeContentPanelUtil';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import epBvrObjectService from 'js/epBvrObjectService';


const HAS_CHILDREN_PROP = 'hasChildren';
const RESEQUENCE_EVENT_TYPE = 'resequence';
const AWB0_BOMLINE_REV_ID = 'awb0BomLineRevId';
const propertiesForNumericSort = [
    epBvrConstants.BL_SEQUENCE_NO
];

/**
 * Load table columns data
 *
 * @param {String} objUid - the object uid to load its related data to display in table
 * @param {String} loadInputObject has loadTypes, propertiesToLoad, targetUid, additionalLoadParams, loadedObjectMapKeys
 *
 * @return {ObjectArray} rowsObjects - the table rows objects
 * @return {ObjectArray} totalRows - the number of table rows
 */
export function loadColumnsData( objUid, loadInputObject ) {
    const deferred = awPromiseService.instance.defer();
    if( !objUid ) {
        return {
            rowsObjects: [],
            totalRows: 0
        };
    }

    const {
        loadTypes,
        propertiesToLoad,
        targetUid,
        additionalLoadParams,
        loadedObjectMapKeys,
        relatedObjectMapKey
    } = loadInputObject;
    loadDataFromLoadedResponse( objUid, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, loadedObjectMapKeys, relatedObjectMapKey ).then( ( result ) => {
        deferred.resolve( result );
    } );
    return deferred.promise;
}

/**
 * Function accepts loadTypeInputs for creating inputs data for SOA call
 *
 * @param {string} objUid - the node uid
 * @param {StringArray} loadTypes - the load types
 * @param {StringArray} propertiesToLoad - the properties to load
 * @param {string} targetUid - the target uid
 * @param {StringArray} additionalLoadParams - additional params
 * @param {StringArray} loadedObjectMapKeys - keys for loadedObjectsMap
 * @param {StringArray} relatedObjectMapKey - key for relatedObjectMap
 * @returns {Object} data for table
 */
export function loadDataFromLoadedResponse( objUid, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, loadedObjectMapKeys, relatedObjectMapKey ) {
    if( !objUid ) {
        return;
    }

    const policyId = registerGetPropertyPolicy();

    return loadAllProperties( objUid, propertiesToLoad, loadTypes, targetUid, additionalLoadParams ).then( ( response ) => {
        let rowsObjects = [];
        if( propertiesToLoad ) {
            rowsObjects.push( ...getProperties( objUid, propertiesToLoad ) );
        }
        if( loadedObjectMapKeys && response.loadedObjectsMap ) {
            const loadedObjects = response.loadedObjectsMap[ loadedObjectMapKeys ];
            loadedObjects && rowsObjects.push( ...loadedObjects );
        }

        policyId && policySvc.unregister( policyId );

        //check if response.relatedObjectsMap contains relatedObjectMapKey
        if( doesResponseContainRelatedObjectsMapKey( objUid, response, relatedObjectMapKey ) ) {
            if( !Array.isArray( relatedObjectMapKey ) ) {
                relatedObjectMapKey = [ relatedObjectMapKey ];
            }
            relatedObjectMapKey.forEach( prop => {
                if( response.relatedObjectsMap[ objUid ].additionalPropertiesMap2[ prop ] ) {
                    const relatedObjects = response.relatedObjectsMap[ objUid ].additionalPropertiesMap2[ prop ];
                    relatedObjects.indexOf( '' ) === -1 && relatedObjects.forEach( relatedObject => {
                        rowsObjects.push( response.ServiceData.modelObjects[ relatedObject ] );
                    } );
                }
            } );
        }

        const totalRows = rowsObjects ? Object.keys( rowsObjects ).length : 0;
        sortChildrenByProp( rowsObjects, epBvrConstants.BL_SEQUENCE_NO ); //this sort will not be needed when server will be fixed to create non decimal find numbers
        return {
            rowsObjects,
            totalRows
        };
    } );
}

/**
 * Check if response.relatedObjectsMap contains given relatedObjectMapKey. If yes, then only add it to rowsObjects.
 *
 * @param {String} objUid objUid
 * @param {Object} response response
 * @param {Array/Object} relatedObjectMapKey relatedObjectMapKey
 *
 * @returns {Boolean} true or false based on if response.relatedObjectsMap contains given relatedObjectMapKey
 */
function doesResponseContainRelatedObjectsMapKey( objUid, response, relatedObjectMapKey ) {
    if( response.relatedObjectsMap && response.relatedObjectsMap.hasOwnProperty( objUid ) && relatedObjectMapKey ) {
        if( Array.isArray( relatedObjectMapKey ) ) {
            return relatedObjectMapKey.some( key => Object.keys( response.relatedObjectsMap[ objUid ].additionalPropertiesMap2 ).includes( key ) );
        }
        return Object.keys( response.relatedObjectsMap[ objUid ].additionalPropertiesMap2 ).includes( relatedObjectMapKey );
    }
}

/**
 * set hasChildren property to vmo.
 * @param { Object } vmo - viewModel Object onto which property will be set
 * @param { String } propertyKey - property key name
 */
function setHasChildrenPropertyValues( vmo, propertyKey ) {
    const updatedVmo = constructHasChildrenPropOnVmo( vmo );
    const additionalPropertiesMap = epObjectPropertyCacheService.getProperty( updatedVmo.uid, propertyKey );
    const isLeafNode = !( additionalPropertiesMap && additionalPropertiesMap[ 0 ] === 'TRUE' );
    updatedVmo.props.hasChildren.value = isLeafNode;
    updatedVmo.props.hasChildren.dbValues = isLeafNode === true ? [ '0' ] : [ '1' ];
}

/**
 * Add hasChilderen property to the vmo object
 *
 * @param {Object} vmo - the view model object
 * @returns {Object} the updated vmo with the hasChildren property
 */
function constructHasChildrenPropOnVmo( vmo ) {
    const hasChildrenProperty = {
        value: false,
        displayValue: '',
        dbValues: [],
        propType: 'BOOLEAN',
        displayName: HAS_CHILDREN_PROP
    };
    vmo.props.hasChildren = viewModelObjectService.constructViewModelProperty( hasChildrenProperty, HAS_CHILDREN_PROP, vmo, false );
    return vmo;
}

/**
 * Load properties in order to have each tab contentCount (number of object displayed in the tab content)
 *
 * @param {String} objUid - the object uid to load its related data to display in tabs
 * @param {StringArray} propertiesToLoad - list of all tabs properties to get their content
 * @param {StringArray} loadTypes - the load types such as: GetScopeAssembly
 * @param {String} targetUid - the target uid
 * @param {StringArray} additionalLoadParams - additional load params
 *
 * @returns {Object} the object properties
 */
export function loadAllProperties( objUid, propertiesToLoad, loadTypes = [], targetUid, additionalLoadParams ) {
    propertiesToLoad && loadTypes.indexOf( epLoadConstants.GET_PROPERTIES ) < 0 && loadTypes.push( epLoadConstants.GET_PROPERTIES );
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( loadTypes, objUid, propertiesToLoad, targetUid, additionalLoadParams );
    return epLoadService.loadObject( loadTypeInput, false );
}

/**
 * Function accepts Object UID and Properties array to get
 *
 * @param { String } objUid : objects UID
 * @param { array } propertiesToLoad the props to load
 *
 * @returns {Object} data for table
 */
function getProperties( objUid, propertiesToLoad ) {
    const currModelObject = cdm.getObject( objUid );
    const relatedObjectsUids = propertiesToLoad.flatMap( prop  => {
        if( currModelObject.props[ prop ] ) {
            return currModelObject.props[ prop ].dbValues;
        }
    } ).filter( Boolean );
    return relatedObjectsUids.map( uid => cdm.getObject( uid ) );
}

/**
 * Load data for tree for the first time i.e. entire process tree
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {String} topNodeUid : trees top node Uid
 * @param {Object} rootLoadInputData - the table data provider
 * @param {Object} childLoadInputData - the table data provider
 * @param {String} isLeafProperty - is leaf property
 *
 * @return {ObjectArray} treeLoadResult - treeLoadResult
 */
export function initializeLoadDataForTree( treeLoadInput, topNodeUid, rootLoadInputData, childLoadInputData, isLeafProperty = 'bl_has_children' ) {
    const parentNode = treeLoadInput.parentNode;
    const nodeToExpand = parentNode.uid;
    const isRootNode = nodeToExpand === topNodeUid;

    treeLoadInput.parentNode.cursorObject = {
        startReached: true,
        endReached: true
    };

    const inputDataObject = isRootNode ? rootLoadInputData : childLoadInputData;
    const {
        loadTypes = 'CommonExpand',
        propertiesToLoad = '',
        targetUid,
        additionalLoadParams,
        relatedObjectMapKey
    } = inputDataObject;

    return loadDataFromLoadedResponse( nodeToExpand, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, {}, relatedObjectMapKey ).then( function( result ) {
        /**
         * For initial load, the top process and its children must be visible
         */

        const childTreeNodes = [];
        let topNode;
        const topNodeModelObject = cdm.getObject( topNodeUid );
        const topNodeVMO = mfeVMOService.createViewModelObjectFromModelObject( topNodeModelObject );
        if( topNodeVMO && isLeafProperty === HAS_CHILDREN_PROP ) {
            setHasChildrenPropertyValues( topNodeVMO, HAS_CHILDREN_PROP );
        }
        topNode = mfeTableService.getTreeNodeObject( topNodeVMO, parentNode, mfeTableService.isLeaf( topNodeVMO, isLeafProperty ), 0 );
        topNode.children = [];
        childTreeNodes.push( topNode );

        result.rowsObjects.forEach( ( rowObject, childNdx ) => {
            let rowObjectVMO = mfeVMOService.createViewModelObjectFromModelObject( rowObject );
            if( rowObjectVMO && isLeafProperty === HAS_CHILDREN_PROP ) {
                setHasChildrenPropertyValues( rowObjectVMO, HAS_CHILDREN_PROP );
            }
            const childNode = mfeTableService.getTreeNodeObject( rowObjectVMO, topNode, mfeTableService.isLeaf( rowObjectVMO, isLeafProperty ), childNdx );

            childTreeNodes.push( childNode );
            childNode.props.bl_parent && childNode.props.bl_parent.dbValues[ 0 ] === topNode.uid && topNode.children.push( childNode );
            setIsOpaqueProperty( rowObjectVMO, false );
        } );

        //Disabling pagination
        treeLoadInput.pageSize = childTreeNodes.length;
        const endReached = treeLoadInput.startChildNdx + treeLoadInput.pageSize > childTreeNodes.length;
        const treeLoadResult = awTableService.buildTreeLoadResult( treeLoadInput, childTreeNodes, false, true, endReached, null );

        if( nodeToExpand === topNodeUid && !parentNode.isExpanded ) {
            topNode.isExpanded = true;
        }
        return {
            treeLoadResult: treeLoadResult
        };
    } );
}

/**
 * loadTreeTableData
 *
 * @param {Object} treeLoadInput treeLoadInput object
 * @param {String} topNodeUid - trees top node Uid
 * @param {Boolean} isTopNode - if topNodeUid is a top node
 * @param {Object} rootLoadInputData - the table data provider
 * @param {Object} childLoadInputData - the table data provider
 * @param {String} isLeafProperty - is leaf property
 * @param {Object} sortCriteria - sort criteria
 *
 *
 * @return {ObjectArray} treeLoadResult - treeLoadResult
 */
export function loadTreeTableData( treeLoadInput, topNodeUid, isTopNode, rootLoadInputData, childLoadInputData,
    isLeafProperty = epBvrConstants.MBC_HAS_SUB_ELEMENTS, sortCriteria ) {
    const parentNode = treeLoadInput.parentNode;
    const nodeToExpand = parentNode.uid;
    const isRootNode = nodeToExpand === topNodeUid;

    treeLoadInput.parentNode.cursorObject = {
        startReached: true,
        endReached: true
    };

    const inputDataObject = isRootNode ? rootLoadInputData : childLoadInputData;
    const {
        loadTypes = 'CommonExpand',
        propertiesToLoad = '',
        targetUid,
        additionalLoadParams,
        relatedObjectMapKey
    } = inputDataObject;

    return loadDataFromLoadedResponse( nodeToExpand, loadTypes, propertiesToLoad, targetUid, additionalLoadParams, null, relatedObjectMapKey ).then( function( result ) {
        let childTreeNodes = [];
        let isEmptyTopNode = false;

        if( isTopNode && isRootNode && result.rowsObjects.length === 0 ) {
            const topNodeModelObject = cdm.getObject( topNodeUid );
            let topNodeVMO = mfeVMOService.createViewModelObjectFromModelObject( topNodeModelObject );
            let topNode = mfeTableService.getTreeNodeObject( topNodeVMO, parentNode, mfeTableService.isLeaf( topNodeVMO, isLeafProperty ), 0 );
            topNode.children = [];
            childTreeNodes.push( topNode );
            isEmptyTopNode = true;
        }
        result.rowsObjects.forEach( ( rowObject, childNdx ) => {
            if( rowObject ) {
                let rowObjectVMO = mfeVMOService.createViewModelObjectFromModelObject( rowObject );
                setIsOpaqueProperty( rowObjectVMO, false );
                if( rowObjectVMO && isLeafProperty === HAS_CHILDREN_PROP ) {
                    setHasChildrenPropertyValues( rowObjectVMO, HAS_CHILDREN_PROP );
                }
                childTreeNodes.push( mfeTableService.getTreeNodeObject( rowObjectVMO, parentNode, mfeTableService.isLeaf( rowObjectVMO, isLeafProperty ), childNdx ) );
            }
        } );

        //Disabling pagination
        treeLoadInput.pageSize = childTreeNodes.length;
        const endReached = treeLoadInput.startChildNdx + treeLoadInput.pageSize > childTreeNodes.length;
        const treeLoadResult = awTableService.buildTreeLoadResult( treeLoadInput, childTreeNodes, false, true, endReached, null );

        if( isTopNode && nodeToExpand === topNodeUid && !parentNode.isExpanded && !isEmptyTopNode ) {
            const vmo = mfeVMOService.createViewModelObjectFromUid( topNodeUid );
            const topNode = mfeTableService.getTreeNodeObject( vmo, parentNode, false, 0 );
            topNode.isExpanded = true;
            topNode.children = childTreeNodes;
            treeLoadResult.rootPathNodes = [ parentNode, topNode ];
        }

        if( sortCriteria && sortCriteria[ 0 ] ) {
            const { fieldName } = sortCriteria[ 0 ];
            if( propertiesForNumericSort.includes( fieldName ) ) {
                treeLoadResult.childNode =  mfeFilterAndSortService.sortModelObjectsBasedOnStringNumericValue( treeLoadResult.childNodes, sortCriteria );
            } else{
                treeLoadResult.childNodes = mfeFilterAndSortService.sortModelObjects( treeLoadResult.childNodes, sortCriteria );
            }
        }

        return {
            treeLoadResult: treeLoadResult
        };
    } );
}

/**
 * Remove or Add Objects
 *
 * @param {String} actionType - Remove or Add
 * @param {Object/ObjectArray} inputObj - the object/objects: its related objects to remove or add new objects to
 * @param {ObjectArray} selectedObjects - the objects to remove or add
 * @param {String} entryName - the save input entry name
 * @param {String} relationType - the relation type name
 *
 * @returns {Object} the save changes response
 */
export function removeOrAddObjects( actionType, inputObj, selectedObjects, entryName, relationType ) {
    const objectsToRemoveOrAdd = selectedObjects.map( obj => obj.uid );
    const saveInputWriter = saveInputWriterService.get();
    let relatedObject = [];

    if( Array.isArray( inputObj ) ) {
        inputObj.forEach( ( object ) => {
            saveInputWriter.addRemoveOrAddObjects( actionType, object.uid, objectsToRemoveOrAdd, entryName, relationType );
        } );

        relatedObject = [ ...selectedObjects, ...inputObj ];
    } else {
        saveInputWriter.addRemoveOrAddObjects( actionType, inputObj.uid, objectsToRemoveOrAdd, entryName, relationType );
        relatedObject = [ ...selectedObjects, inputObj ];
    }

    return epSaveService.saveChanges( saveInputWriter, true, relatedObject );
}

/**
 * Handle the events which were returned from the save soa server call
 *
 * @param {Object} saveEvents - the save events as json object
 * @param {String} relationNames - the relation type names
 * @param {Object} dataProvider - the table data provider
 * @param {String} inputObjectUid - selected tab scopeObject Uid
 * @param {Boolean} selectAddedObjects - flag indicating if the added objects should be selected
 * @param {Boolean} shouldHandleCreateEvent - flag indicating if want to handle create events
 */
export function handleAddRemoveSaveEvents( saveEvents, relationNames, dataProvider, inputObjectUid, selectAddedObjects = true, shouldHandleCreateEvent ) {
    if( !Array.isArray( relationNames ) ) {
        relationNames = [ relationNames ];
    }
    relationNames.forEach( ( relationName ) => {
        let relevantEvents = saveEvents[ relationName ];
        if( relevantEvents ) {
            if( !Array.isArray( relevantEvents ) ) {
                relevantEvents = [ relevantEvents ];
            }
            relevantEvents.forEach( ( event ) => {
                // confirm tab scope object and save event object is same, or else no need to update tab content
                if( event.eventObjectUid === inputObjectUid && event.relatedEvents ) {
                    const relatedEvents = event.relatedEvents;
                    const objUidToDeleteList = relatedEvents[ epSaveConstants.DELETE ];
                    const objUidToRemoveList = relatedEvents[ epSaveConstants.REMOVED_FROM_RELATION ];
                    const objUidToAddList = relatedEvents[ epSaveConstants.ADDED_TO_RELATION ];
                    if( objUidToRemoveList && objUidToRemoveList.length > 0 ) {
                        mfeTableService.removeFromDataProvider( objUidToRemoveList, dataProvider );
                    }
                    if( objUidToDeleteList && objUidToDeleteList.length > 0 ) {
                        mfeTableService.removeFromDataProvider( objUidToDeleteList, dataProvider );
                    }
                    addNewObjectsToDataProvider( objUidToAddList, dataProvider, selectAddedObjects );
                }
            } );
        }
    } );
}

/**
 * Add new objects to data provider
 *
 * @param {StringArray} objUidToAddList - the new object uid list to be added to the data provider
 * @param {Object} dataProvider - the table data provider
 * @param {Boolean} selectAddedObjects - flag indicating if the added objects should be selected
 */
export function addNewObjectsToDataProvider( objUidToAddList, dataProvider, selectAddedObjects ) {
    if( objUidToAddList && objUidToAddList.length > 0 ) {
        mfeTableService.addToDataProvider( objUidToAddList, dataProvider, selectAddedObjects );
    }
}

/**
 * @param {object} column - column configuration
 * @param {object} rowVMO - row vmo
 *
 * @return {Boolean} isOpaque - returns true if the partial visibility for row vmo is set
 */
function isOpaque( column, rowVMO ) {
    return rowVMO.props.isOpaque ? rowVMO.props.isOpaque.dbValues === true : false;
}

/**
 * Create view model property 'isOpaque' for tree node
 *
 * @param {object} vmo - vmo
 * @param {object} propertyValue - property value for isOpaque
 */
export function setIsOpaqueProperty( vmo, propertyValue ) {
    const isOpaqueProperty = {
        value: propertyValue,
        displayValue: '',
        propType: 'BOOLEAN',
        isArray: false,
        displayName: 'isOpaque'
    };
    vmo.props.isOpaque = viewModelObjectService.constructViewModelProperty( isOpaqueProperty, 'isOpaque', vmo, false );
}

/**
 * Add child nodes
 *
 * @param {Object} dataProvider - the table data provider
 * @param {Object} parentObject - parent object
 * @param {Array} childObjectsToAdd - child objects to add
 * @param {String} isLeafProperty - property type
 * @param {Object} objectToAddAfter - object to add after
 * @param {Object} tableGridId - the table grid id
 */
function addChildNodes( dataProvider, parentObject, childObjectsToAdd, isLeafProperty = epBvrConstants.MBC_HAS_SUB_ELEMENTS, objectToAddAfter, tableGridId ) {
    const parentTreeNode = getTreeNode( dataProvider, parentObject );
    if ( parentTreeNode ) {
        const childNodeToAddAfter = objectToAddAfter ? getTreeNode( dataProvider, objectToAddAfter ) : undefined;
        if( parentTreeNode.isExpanded || parentTreeNode.isLeaf ) {
            mfeTableService.appendChildNodes( parentTreeNode, childObjectsToAdd, dataProvider, mfeTableService.isLeaf, isLeafProperty, childNodeToAddAfter );
            parentTreeNode.isExpanded = true;
            parentTreeNode.isLeaf = false;
            mfeSyncUtils.setSelection( dataProvider, childObjectsToAdd );
        } else {
            parentTreeNode.isExpanded = true;
            parentTreeNode.isLeaf = false;
            eventBus.publish( `${tableGridId}.plTable.toggleTreeNode`, parentTreeNode );
            mfeSyncUtils.setSelection( dataProvider, childObjectsToAdd );
        }
    }
}

/**
 * Remove child nodes
 *
 * @param {Object} dataProvider - the table data provider
 * @param {Object} parentObject - parent object
 * @param {Array} childObjectsToRemove - child objects to remove
 */
export function removeChildNodes( dataProvider, parentObject, childObjectsToRemove ) {
    const parentTreeNode = getTreeNode( dataProvider, parentObject );
    mfeTableService.removeSelection( dataProvider, childObjectsToRemove );
    mfeTableService.removeChildNodes( parentTreeNode, childObjectsToRemove, dataProvider );
}

/**
 * get Tree Node from dataProvider
 *
 * @param {Object} dataProvider - the save events as json object
 * @param {Object} modelObject - event Type
 *
 * @returns {Object} the tree node
 */
function getTreeNode( dataProvider, modelObject ) {
    return modelObject && dataProvider.viewModelCollection.getLoadedViewModelObjects().find( loadedVmo => loadedVmo.uid === modelObject.uid );
}

/**
 * set selection in tree
 * if objectsToSelect isn't loaded, load hierarchy till objectsToSelect.
 * Note : objectsToSelect is a vmo when an object is selected.But objectsToSelect is a null array when an object is deselected.
 *
 * @param {Object} dataProvider data provider
 * @param {Object} objectsToSelect vmo of object to select
 * @param {String} propertyToSort property to sort objects
 * @param {Boolean} unselectIfEmpty unselect if empty
 */
export function setSelection( dataProvider, objectsToSelect, propertyToSort, unselectIfEmpty = false ) {
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    /* Check if objectsToSelect is empty {}. If empty, we need to skip loading hierarchy.
         Otherwise it gives "Structure type not supported" error. */
    if( objectsToSelect && !( Object.keys( objectsToSelect ).length === 0 && objectsToSelect.constructor === Object ) ) {
        objectsToSelect = !Array.isArray( objectsToSelect ) ? [ objectsToSelect ] : objectsToSelect;
        if( loadedObjects.length !== 0 ) {
            let vmosAlreadySelect = mfeSyncUtils.setSelection( dataProvider, objectsToSelect, unselectIfEmpty );
            const uidListForVmosAlreadySelected = vmosAlreadySelect ? vmosAlreadySelect.map( object => object.uid ) : [];
            let objectsToExpand = objectsToSelect.filter( loadedObj => loadedObj.uid && uidListForVmosAlreadySelected.indexOf( loadedObj.uid ) === -1 );
            objectsToExpand && objectsToExpand[ 0 ] && loadHierarchy( dataProvider, objectsToSelect, objectsToExpand, propertyToSort );
        }
    }
}

/**
 * loads the hierarchy till objectToSelect and expand
 *
 * @param {Object} dataProvider data provider
 * @param {ObjectsList} objectsToSelect objects to select
 * @param {Object} objectsToExpand object to expand
 * @param {String} propertyToSort property to sort by
 *
 * @returns {Object} the loaded hierarchy
 */
function loadHierarchy( dataProvider, objectsToSelect, objectsToExpand, propertyToSort ) {
    if( objectsToExpand.length > 0 ) {
        const policyId = registerLoadHierarchyPolicy();
        let loadTypeInput = [];
        objectsToExpand.forEach( object => {
            loadTypeInput.push( epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_HIERARCHY ], object.uid )[ 0 ] );
        } );
        return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => {
            policyId && policySvc.unregister( policyId );
            const parentChildObjectsMap = getParentChildObjectsMap( dataProvider, response.loadedObjects );
            let parentUids = [];
            objectsToExpand.forEach( object => {
                const allParentUids = getParentUids( object, epBvrConstants.BL_PARENT );
                const newParentUids = allParentUids.filter( ( parentUid ) => parentUids.indexOf( parentUid ) === -1 );
                parentUids.push( ...newParentUids );
            } );
            expandNodes( dataProvider, parentChildObjectsMap, parentUids, propertyToSort );

            dataProvider.selectionModel.setSelection( objectsToSelect );
        } );
    }
}

/**
 * Register the policy
 *
 * @return {Object}  null
 */
function registerLoadHierarchyPolicy() {
    const loadHierarchyPolicy = {
        types: [ {
            name: epBvrConstants.MFG_BVR_OPERATION,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            } ]
        },
        {
            name: epBvrConstants.MFG_BVR_PROCESS,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            },
            {
                name: epBvrConstants.MBC_HAS_SUB_ELEMENTS
            }
            ]
        },
        {
            name: 'BOMLine',
            properties: [ {
                name: 'bl_sequence_no'
            },
            {
                name: 'bl_has_children'
            }
            ]
        }
        ]
    };
    return policySvc.register( loadHierarchyPolicy );
}

/**
 * creates parent to child objects map
 *
 * @param {Object} dataProvider data provider
 * @param {Array} hierarchyObjects objects in hierarchy
 * @return {Array} parent to child objects map
 */
function getParentChildObjectsMap( dataProvider, hierarchyObjects ) {
    let parentChildObjectsMap = {};
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    hierarchyObjects.filter( ( object, index ) => {
        return hierarchyObjects.indexOf( object ) === index;
    } ).forEach( hierarchyObject => {
        const index = loadedObjects.findIndex( loadedObj => loadedObj.uid === hierarchyObject.uid );
        if( index === -1 ) {
            const parentUid = hierarchyObject.props.bl_parent && hierarchyObject.props.bl_parent.dbValues[ 0 ];
            parentChildObjectsMap[ parentUid ] ? parentChildObjectsMap[ parentUid ].push( hierarchyObject ) : parentChildObjectsMap[ parentUid ] = [ hierarchyObject ];
        }
    } );
    return parentChildObjectsMap;
}

/**
 * Get parent Uids
 *
 * @param {object} objectToSelect : object to select
 * @param {String} parentProperty property of parent
 * @return {Array} parent objects Uids of selected object in the hierarchy
 */
function getParentUids( objectToSelect, parentProperty ) {
    const parentHierarchy = [];
    let currentObj = objectToSelect;
    let parentUid = currentObj.props[ parentProperty ] && currentObj.props[ parentProperty ].dbValues[ 0 ];
    while( parentUid ) {
        parentHierarchy.push( parentUid );
        currentObj = cdm.getObject( parentUid );
        parentUid = currentObj.props[ parentProperty ] && currentObj.props[ parentProperty ].dbValues[ 0 ];
    }
    return parentHierarchy;
}

/**
 * Sort children node according to property
 *
 * @param {Object} childObjects Objects to sort
 * @param {String} propertyToSort the property to sort by
 */
function sortChildrenByProp( childObjects, propertyToSort ) {
    //TODO : Server is sending bl_sequence number property as a string so we need to tweak it.
    if( propertyToSort === epBvrConstants.BL_SEQUENCE_NO ) {
        // eslint-disable-next-line array-callback-return
        childObjects.map( ( obj ) => {
            //Updating property type to 5(Integer)
            if( obj.props[ propertyToSort ] ) {
                obj.props[ propertyToSort ].propertyDescriptor.valueType = 5;
            }
        } );
    }
    mfeFilterAndSortService.sortModelObjectsByProp( childObjects, propertyToSort, true );
}

/**
 * Expands parent nodes of selected object. And sort according to property to sort.
 * e.g. "bl_sequence_no"
 *
 * @param {Object} dataProvider data provider
 * @param {Map} parentChildObjectsMap Map of parent uid to child objects
 * @param {Array} parentUids - parent objects Uids of selected object
 * @param {String} propertyToSort - the property to sort by
 */
function expandNodes( dataProvider, parentChildObjectsMap, parentUids, propertyToSort ) {
    let isLeafProperty = null;
    if( parentUids.length > 0 ) {
        let modelObject = cdm.getObject( parentUids[ 0 ] );
        if( modelObject.type === epBvrConstants.MFG_BVR_PROCESS ) {
            isLeafProperty = epBvrConstants.MBC_HAS_SUB_ELEMENTS;
        } else if( modelObject.type === 'BOMLine' ) {
            isLeafProperty = 'bl_has_children';
        }
    }
    for( let i = parentUids.length - 1; i >= 0; i-- ) {
        const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        const parentTreeNode = loadedObjects.find( loadedObj => loadedObj.uid === parentUids[ i ] );
        if( parentTreeNode && !parentTreeNode.isExpanded ) {
            parentTreeNode.isExpanded = true;
            const childObjects = parentChildObjectsMap[ parentTreeNode.uid ];
            propertyToSort && sortChildrenByProp( childObjects, propertyToSort );

            mfeTableService.appendChildNodes( parentTreeNode, childObjects, dataProvider, mfeTableService.isLeaf, isLeafProperty );
        }
    }
}

/**
 * get Operation Parent Object
 * @param {Object} modelObject Object
 * @param {Object} targetAssembly Object
 * @return {Object} scope object for Create Object
 */
export function getOperationParent( modelObject, targetAssembly ) {
    let scopeInfo = {
        modelObject: modelObject,
        targetAssembly: targetAssembly
    };

    if( mfeTypeUtils.isOfType( modelObject, epBvrConstants.MFG_BVR_OPERATION ) && modelObject.props.bl_parent ) {
        scopeInfo.modelObject = cdm.getObject( modelObject.props.bl_parent.dbValues[ 0 ] );
    }
    scopeInfo.reloadType = modelObject.reloadType;
    scopeInfo.isResequenceNeeded = modelObject.isResequenceNeeded;

    return scopeInfo;
}

/**
 * get input object from commandContext object
 * @param {Object} commandContext object
 * @return {Object} input object from commandContext object
 */
export function getInputObject( commandContext ) {
    if( Array.isArray( commandContext.inputObject ) ) {
        return commandContext.inputObject[ 0 ];
    }
    if( commandContext.vmo ) {
        return commandContext.vmo;
    }
    if( commandContext.vmo ) {
        return commandContext.vmo;
    }
    return commandContext.inputObject;
}

/**
 * get the object parent
 * @param {Object} modelObject object
 * @return {Object} object parent
 */
function getObjectParent( modelObject ) {
    let objectParent;
    if( modelObject.props.bl_parent ) {
        objectParent = cdm.getObject( modelObject.props.bl_parent.dbValues[ 0 ] );
    } else {
        const objectParentUid = epObjectPropertyCacheService.getProperty( modelObject.uid, 'bl_parent' )[ 0 ];
        objectParent = cdm.getObject( objectParentUid );
    }
    return objectParent;
}

/**
 * get the object parent if single object is selected
 * @param {Array} selectedObjects the objects selected in tree
 * @return {Object} selected object parent
 */
export function getSelectedObjectParent( selectedObjects ) {
    let selectedObjectParent;
    if( selectedObjects.length === 1 ) {
        selectedObjectParent = getObjectParent( selectedObjects[ 0 ] );
    }
    return {
        selectedObjectParent: selectedObjectParent
    };
}

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column object_string
 *
 * @param {Object} eventData containing viewModelObjects
 */
export function updateDisplayName( eventData ) {
    //update the display name for all ViewModelObjects which should be viewModelTreeNodes

    if( eventData && eventData.modifiedObjects && eventData.vmc ) {
        let loadedVMObjects = eventData.vmc.loadedVMObjects;
        eventData.modifiedObjects.forEach( modifiedObject => {
            let modifiedVMOs = loadedVMObjects.filter( function( vmo ) {
                return vmo.id === modifiedObject.uid;
            } );
            modifiedVMOs.forEach( modifiedVMO => {
                modifiedVMO.displayName = modifiedObject.props.object_string.dbValues[ 0 ];
            } );
        } );
    }
}

/**
 * sets the commandContext if the save event data is related
 *
 * @param {Object} subPanelContext - subPanelContext object
 * @param {object} commandContext - anything you want to be set as the command context
 * @param {object} saveEventsData - save events data
 */
export function initTableRowsSelectionBasedOnSaveEvents( subPanelContext, commandContext, saveEventsData ) {
    let isEventRelated = false;
    if( saveEventsData ) {
        const saveEventsDataKeys = Object.keys( saveEventsData );
        let relationNames = subPanelContext.relationName;
        if( !Array.isArray( relationNames ) ) {
            relationNames = [ relationNames ];
        }
        saveEventsDataKeys && saveEventsDataKeys.some( ( saveEventDataKey ) => {
            relationNames && relationNames.forEach( ( relationName ) => {
                if( saveEventDataKey === relationName ) {
                    isEventRelated = true;
                    return true;
                }
            } );
        } );
    }
    if( isEventRelated ) {
        mfeContentPanelUtil.setCommandContext( subPanelContext.tabContext, commandContext );
    }
}

/**
 * Register the policy
 *
 * @return {Object}  null
 */
function registerGetPropertyPolicy() {
    const getPropertiesPolicy = {
        types: [ {
            name: epBvrConstants.MFG_BVR_OPERATION,
            properties: [ {
                name: 'Mfg0assigned_workarea',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: epBvrConstants.MFG_BVR_PROCESS,
            properties: [ {
                name: 'Mfg0assigned_workarea',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: 'Mfg0BvrBOPWorkarea',
            properties: [ {
                name: 'bl_item_object_name'
            } ]
        }
        ]
    };
    return policySvc.register( getPropertiesPolicy );
}


/**
 * get the object parent
 * @param {Object} objectArray1 - Array of model objects to be checked
 * @param {Object} objectArray2 - Source array of model objects to find
 * @return {boolean} returns whether same objects or not
 */
function isObjectArraySubsetofOtherObjectArray( objectArray1, objectArray2 ) {
    if( !Array.isArray( objectArray1 ) || !Array.isArray( objectArray2 ) || _.isEmpty( objectArray1 ) || _.isEmpty( objectArray2 ) || objectArray1.length === 0 || objectArray2.length === 0 ) {
        return false;
    }

    const uidList1 = objectArray1.map( obj => obj.uid );
    const uidList2 = objectArray2.map( obj => obj.uid );

    return uidList1.every( function( val ) {
        return uidList2.indexOf( val ) >= 0;
    } );
}


/**
 * Handle the events which were returned from the save soa server call for add operation and remove operation
 *
 * @param {Object} eventData - the save events as json object
 * @param {Object} dataProvider - the table data provider
 * @param {Object} tableGridId - the table grid id
 */
export function handleSaveEvents( eventData, dataProvider, tableGridId, relationNames ) {
    const parsedSaveEvents = eventData.saveEvents && epSaveService.parseSaveEvents( eventData.saveEvents );
    if( relationNames && !Array.isArray( relationNames ) ) {
        relationNames = [ relationNames ];
    }

    //For updating the objects props in tree
    const resequenceEvent = getEventData( eventData, RESEQUENCE_EVENT_TYPE );
    const modifyPropsEvent = getEventData( eventData, epSaveConstants.EVENT_MODIFY_PRIMITIVE_PROPERTIES );
    modifyPropsEvent && modifyPropsEvent.length > 0 && resequenceEvent.length === 0 && handleModifyProperties( eventData, modifyPropsEvent, dataProvider );

    const deleteEvent = [];
    const createEvent = [];

    relationNames && relationNames.forEach( ( relationName ) => {
        let relevantEvents = parsedSaveEvents[ relationName ];

        if( relevantEvents ) {
            deleteEvent.push( ...getEventData( eventData, epSaveConstants.REMOVED_FROM_RELATION ) );
            createEvent.push( ...getEventData( eventData, epSaveConstants.ADDED_TO_RELATION ) );
        }
    } );
    //For Remove Operation
    deleteEvent.push( ...getEventData( eventData, epSaveConstants.DELETE ) );
    deleteEvent && deleteEvent.length > 0 && handleRemoveOperation( deleteEvent, dataProvider );

    //For Create Operation
    createEvent.push( ...getEventData( eventData, epSaveConstants.CREATE_EVENT ) );
    createEvent && createEvent.length > 0 && handleAddOperation( eventData, createEvent, dataProvider, tableGridId );
}

/**
 * Handle save events for add operation
 *
 * @param {Object} eventData - the save events as json object
 * @param {Object} createEvents - the save events as json object
 * @param {Object} dataProvider - the table data provider
 * @param {Object} tableGridId - the table grid id
 */
function handleAddOperation( eventData, createEvents, dataProvider, tableGridId ) {
    let createdOperations = [];
    let childObjectsToAddUids = [];
    createEvents.forEach( createEvent => {
        const createdOperationUid = createEvent.eventObjectUid;
        childObjectsToAddUids.push( createdOperationUid );
        const createdOperation = cdm.getObject( createdOperationUid );
        createdOperation && ( mfeTypeUtils.isOfType( createdOperation, epBvrConstants.MFG_BVR_OPERATION ) || mfeTypeUtils.isOfType( createdOperation, epBvrConstants.MFG_BVR_PROCESS ) ||
        mfeTypeUtils.isOfType( createdOperation, epBvrConstants.MFG_PROCESS_AREA ) ) && createdOperations.push( createdOperation );
    } );

    if( createdOperations.length > 0 ) {
        const parentObjectUid = epBvrObjectService.getParent( createdOperations[ 0 ] ).uid;
        epObjectPropertyCacheService.updateProperty( parentObjectUid, epBvrConstants.RELATED_OBJECT_CHILDREN_KEY, childObjectsToAddUids );
        const objToAddAfter = getObjectToAddAfter( eventData, createEvents[ 0 ] );
        parentObjectUid && addChildNodes( dataProvider, cdm.getObject( parentObjectUid ), createdOperations, epBvrConstants.MBC_HAS_SUB_ELEMENTS, objToAddAfter, tableGridId );
    }
}

/**
 * Get tne object to add after
 *
 * @param {Object} eventData - the event data
 * @param {Object} createEvent - the create event
 * @returns {Object} object to add after
 */
function getObjectToAddAfter( eventData, createEvent ) {
    const createdOperationUid = createEvent.eventObjectUid;
    const createdObj = eventData.ServiceData.modelObjects[ createdOperationUid ];
    let parent = epBvrObjectService.getParent( createdObj );
    const children = cdm.getObjects( epObjectPropertyCacheService.getProperty( parent.uid, epBvrConstants.RELATED_OBJECT_CHILDREN_KEY ) );
    children.sort( function( object1, object2 ) {
        const bl_sequence_no_obj1 = Number( object1.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[ 0 ] );
        const bl_sequence_no_obj2 = Number( object2.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[ 0 ] );
        return bl_sequence_no_obj1 - bl_sequence_no_obj2;
    } );

    const toAddAfterIndex = children.findIndex( obj => obj.uid === createdObj.uid );
    return children[ toAddAfterIndex - 1 ];
}

/**
 * Handle save events for remove operation
 *
 * @param {Object} removeEvents - the remove events
 * @param {Object} dataProvider - the table data provider
 */
function handleRemoveOperation( removeEvents, dataProvider ) {
    let removedOperations = [];
    let removedOperationsUids = [];
    removeEvents.forEach( removeEvent => {
        const removedOperationUid = removeEvent.eventObjectUid;
        const removedOperation = cdm.getObject( removedOperationUid );
        removedOperation && ( mfeTypeUtils.isOfType( removedOperation, epBvrConstants.MFG_BVR_OPERATION ) || mfeTypeUtils.isOfType( removedOperation, epBvrConstants.MFG_BVR_PROCESS ) ||
        mfeTypeUtils.isOfType( removedOperation, epBvrConstants.MFG_PROCESS_AREA ) ) && removedOperations.push( removedOperation ) && removedOperationsUids.push( removedOperationUid );
    } );

    if ( removedOperations.length > 0 ) {
        const parentObject = epBvrObjectService.getParent( removedOperations[ 0 ] );
        if( parentObject && parentObject.uid ) {
            epObjectPropertyCacheService.removeProperty( parentObject.uid, epBvrConstants.RELATED_OBJECT_CHILDREN_KEY, removedOperationsUids );
            removeChildNodes( dataProvider, cdm.getObject( parentObject.uid ), removedOperations );
        }
    }
}

/**
 * Handle save events for modify props of object in focus
 *
 * @param {Object} eventData - the save events as json object
 * @param {Object} modifyPropsEvent - the modify props events as json object
 * @param {Object} dataProvider - the table data
 */
function handleModifyProperties( eventData, modifyPropsEvent, dataProvider ) {
    const event = modifyPropsEvent.find( event => event.eventData[ 0 ] === AWB0_BOMLINE_REV_ID || event.eventData[ 0 ] === epBvrConstants.BL_REV_OBJECT_NAME );
    if( event ) {
        const updatedObject = eventData.ServiceData.modelObjects[ event.eventObjectUid ];
        const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        const vmoToUpdate = loadedObjects.find( loadedObj => loadedObj.uid === updatedObject.uid );
        if( vmoToUpdate ) {
            vmoToUpdate.displayName = updatedObject.props.object_string.dbValues[ 0 ];
        }
    }
}

/**
 * filter event data by type
 *
 * @param {Object} eventData - the save events as json object
 * @param {String} eventType - event Type
 *
 * @returns {ObjectsArray} the event data by type
 */
function getEventData( eventData, eventType ) {
    return eventData.saveEvents.filter( event => event.eventType === eventType );
}

/**
 * This function renders the row with partial Visibility styling
 *
 * @param {object} columns - column configuration
 */
export function renderCutIndicationWithDashedOutline( columns ) {
    if( columns ) {
        columns.forEach( ( column ) => {
            if( !column.cellRenderers ) {
                column.cellRenderers = [];
            }
            column.cellRenderers.push( mfeTableService.getRowRenderer( 'aw-ep-partialVisibilityWithDashedOutline', 'opaqueRowRenderer', isOpaque ) );
        } );
    }
}

export default {
    loadColumnsData,
    loadDataFromLoadedResponse,
    loadAllProperties,
    initializeLoadDataForTree,
    loadTreeTableData,
    removeOrAddObjects,
    handleAddRemoveSaveEvents,
    addNewObjectsToDataProvider,
    setIsOpaqueProperty,
    removeChildNodes,
    setSelection,
    getOperationParent,
    getInputObject,
    getSelectedObjectParent,
    updateDisplayName,
    initTableRowsSelectionBasedOnSaveEvents,
    isObjectArraySubsetofOtherObjectArray,
    handleSaveEvents,
    renderCutIndicationWithDashedOutline
};
