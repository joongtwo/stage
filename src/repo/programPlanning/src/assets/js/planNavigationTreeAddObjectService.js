// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/planNavigationTreeAddObjectService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import planNavTreeNodeCreateService from 'js/planNavigationTreeNodeCreateService';

let exports;

/**
 * Creates new tree nodes for the given plan objects and adds them to the view model collection(VMC).
 * The objects will not be added, if the parent is not present in the VMC.
 * The objects will not be added, if it already exists under the parent node.
 * The objects whose parent is collapsed, the parent' exapansion cache will be deleted. The children will be loaded during expansion.
 *
 * @param {Object} dataProvider The tree data provider
 * @param {Array} newPlanObjects Plan objects to be added to the tree.
 */
export let addTreeNodesForPlanObjects = ( dataProvider, newPlanObjects ) => {
    let addPlanObjectInfo = getAddPlanObjectInfo();
    if( !addPlanObjectInfo.parentNodeUid && !addPlanObjectInfo.siblingUid ) {
        return;
    }

    // Filter out the children; the nodes for parent plans, if any,
    // will be added as collapsed by default.
    let newPlanObjectUids = newPlanObjects.map( object => object.uid );
    let uidsToAdd = _.filter( newPlanObjectUids, ( objectUid ) => {
        return newPlanObjectUids.indexOf( getParentPlanUid( objectUid ) ) === -1;
    } );

    // Is this a Save As use case with more than one level ?
    let multiObjectsAdd = newPlanObjectUids.length !== uidsToAdd.length;

    // Iterate and add new nodes.
    let vmCollection = dataProvider.viewModelCollection;
    uidsToAdd.forEach( uidToAdd => {
        let parentUid = getParentPlanUid( uidToAdd );
        if( addPlanObjectInfo.parentNodeUid !== parentUid ) {
            addPlanObjectInfo.parentNodeUid = parentUid;
            addPlanObjectInfo.siblingUid = null;
        }
        addPlanObjectInfo.uidToAdd = uidToAdd;

        addPlanObjectInfo.parentNode = vmCollection.loadedVMObjects.find( vmo => vmo.uid === parentUid );
        // Ignore, if the parent is not found.
        if( !addPlanObjectInfo.parentNode ) {
            return;
        }

        // Ignore, if the child is already present.
        if( addPlanObjectInfo.parentNode.children && addPlanObjectInfo.parentNode.children.findIndex( vmo => vmo.uid === addPlanObjectInfo.uidToAdd ) > -1 ) {
            return;
        }

        // Mark parent node as non-Leaf before adding child
        if( addPlanObjectInfo.parentNode.isLeaf ) {
            addPlanObjectInfo.parentNode.isLeaf = false;
            addPlanObjectInfo.parentNode.isExpanded = true;
            addPlanObjectInfo.parentNode.cursorObject = {
                endReached: true,
                startReached: true
            };
        }

        // Add the children only if the parent(to be) node is expanded.
        // Else, just mark the node as parent i.s. non-leaf.
        if( addPlanObjectInfo.parentNode.isExpanded === undefined && !addPlanObjectInfo.parentNode.isLeaf ) {
            // Delete the cache, if we are adding a child to a collpased parent.
            if( addPlanObjectInfo.parentNode.__expandState ) {
                delete addPlanObjectInfo.parentNode.__expandState;
            }
            return;
        }

        let childNode = undefined;
        if( _.get( addPlanObjectInfo.parentNode, 'cursorObject.endReached', true ) ) {
            let nChildren = _.get( addPlanObjectInfo.parentNode, 'children.length', 0 );
            addPlanObjectInfo.siblingUid = nChildren > 0 ? addPlanObjectInfo.parentNode.children[ nChildren - 1 ].uid : null;

            childNode = addNewChildNode( addPlanObjectInfo, nChildren );
            childNode.isLeaf = _.filter( newPlanObjectUids, objectUid => getParentPlanUid( objectUid ) === childNode.uid ).length <= 0;

            // If it is the first child, add immediately below the parent in view mode collection.
            if( nChildren === 0 ) {
                let parentVmcIndex = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addPlanObjectInfo.parentNode.uid );
                vmCollection.loadedVMObjects.splice( parentVmcIndex + 1, 0, childNode );
            } else {
                addNodeToVmcAfterSibling( vmCollection, childNode, addPlanObjectInfo );
            }
            if( childNode ) {
                // Notify listeners about newly added nodes.
                eventBus.publish( 'planNavigationTree.nodesAdded', { addedNodes: [ childNode ] } );
            }
        }
    } );
    vmCollection.totalObjectsLoaded = vmCollection.loadedVMObjects.length;
    dataProvider.update( vmCollection.loadedVMObjects );
};

/**
 * Creates and adds a new child node to the given parent node at the given index.
 * @param {Object} addPlanObjectInfo Contains information about the plan object to be added.
 * @param {Number} childIndex children index for children property
 * @return {Object} childNode
 */
let addNewChildNode = ( addPlanObjectInfo, childIndex ) => {
    let parentNode = addPlanObjectInfo.parentNode;
    let childUid = addPlanObjectInfo.uidToAdd;
    let modelObject = cdm.getObject( childUid );
    let displayName = _.get( modelObject, 'props.object_string.uiValues[0]', '' );
    let childNode = planNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( modelObject, displayName, parentNode.uid, childIndex, parentNode.levelNdx + 1 );

    if( !parentNode.children ) {
        parentNode.children = [];
    }
    parentNode.children.splice( childIndex, 0, childNode );

    if( !parentNode.totalChildCount ) {
        parentNode.totalChildCount = 0;
    }
    parentNode.totalChildCount += 1;

    for( let index = childIndex + 1; index < parentNode.children.length; ++index ) {
        parentNode.children[ index ].childNdx += 1;
    }

    return childNode;
};

/**
 * Adds the given node to the view model collection
 * @param {*} vmCollection The view model collection to add the node to.
 * @param {*} node The node to add.
 * @param {*} addPlanObjectInfo Information about the parent and sibling of the plan object to add.
 */
let addNodeToVmcAfterSibling = ( vmCollection, node, addPlanObjectInfo ) => {
    let parentVmcIndex = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addPlanObjectInfo.parentNodeUid );
    if( parentVmcIndex <= -1 ) {
        return;
    }

    let siblingVmcIndex = _.findIndex( vmCollection.loadedVMObjects, vmo => vmo.uid === addPlanObjectInfo.siblingUid );
    if( siblingVmcIndex <= -1 ) {
        return;
    }

    let childLevelIndex = vmCollection.loadedVMObjects[ parentVmcIndex ].levelNdx + 1;
    let childVmcIndex = siblingVmcIndex + 1;

    if( childVmcIndex === vmCollection.loadedVMObjects.length ) {
        vmCollection.loadedVMObjects.push( node );
    } else {
        for( childVmcIndex; childVmcIndex < vmCollection.loadedVMObjects.length; ++childVmcIndex ) {
            if( vmCollection.loadedVMObjects[ childVmcIndex ].levelNdx === childLevelIndex ) {
                break;
            }
            if( vmCollection.loadedVMObjects[ childVmcIndex ].levelNdx < childLevelIndex ) {
                break; // This should not happen; parsing the child level is complete.
            }
        }
        vmCollection.loadedVMObjects.splice( childVmcIndex, 0, node );
    }
};

/**
 * Returns information of the current selection, which will be used to add nodes
 * in the tree for the new plan object.
 * @returns {Object} Plan info object containing the UIDs of selected object uid and it's parent.
 */
let getAddPlanObjectInfo = () => {
    let addPlanObjectInfo = {
        parentNodeUid: null,
        siblingUid: null
    };
    let selectedUid = _.get( appCtxSvc, 'ctx.selected.uid', undefined );
    if( _.isEmpty( selectedUid ) ) {
        return addPlanObjectInfo;
    }

    let selectedObject = cdm.getObject( selectedUid );
    if( cmm.isInstanceOf( 'Prg0AbsPlan', selectedObject.modelType ) ) {
        addPlanObjectInfo.parentNodeUid = selectedUid;
    }
    return addPlanObjectInfo;
};

/**
 * Returns the UID of the parent plan object.
 * @param {String} planObjectUid UID of the plan object to fetch the parent
 * @returns {String} the parent plan object UID.
 */
let getParentPlanUid = ( planObjectUid ) => {
    let vmo = cdm.getObject( planObjectUid );
    return _.get( vmo, 'props.prg0ParentPlan.dbValues[0]', undefined );
};

exports = {
    addTreeNodesForPlanObjects
};

export default exports;
