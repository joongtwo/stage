// Copyright (c) 2022 Siemens

/**
 * @module js/MovePlanObjectsService
 */
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

export let getMovePlanObjects = function( activeMoveCommand ) {
    var eventData = {
        activeMove: activeMoveCommand
    };
    eventBus.publish( 'movePlanObjectsEvent', eventData );
};

/**
 * Function to traverse the nested childs and increase its child index
 *
 * @param {Object} treeNodeData tree node data
 * @return {int} returns number of nested children
 */
var traverseIncreaseChildrenIndex = function( treeNodeData ) {
    let childCount = 0;
    if( treeNodeData.children && treeNodeData.children.length > 0 ) {
        for( let i = 0; i < treeNodeData.children.length; i++ ) {
            let newChildren = treeNodeData.children[ i ];
            childCount += 1;
            newChildren.childNdx = treeNodeData.childNdx + 1;
            childCount += traverseIncreaseChildrenIndex( newChildren );
        }
    }
    return childCount;
};

/**
 * Get number of nested child
 *
 * @param {Array} vmNode - selected vmNode
 * @returns {Number} The number of nested chiild
 */
function addChildCount( vmNode ) {
    let index = 0;
    if( vmNode.children && vmNode.children.length > 0 ) {
        index += vmNode.children.length;
        vmNode.children.forEach( ( child ) => {
            index += addChildCount( child );
        } );
    }
    return index;
}

/**
 * Function to perform move up operation
 *
 * @param {Array} loadedVMObjects VMO
 * @param {int} selectedIndex selected index of selected tree node
 * @param {object} selectedTreeNode selected tree node
 * @param {object} prevSibling  previous sibling
 */
var performMoveUp = function( loadedVMObjects, selectedIndex, selectedTreeNode, prevSibling ) {
    var prevPlanIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === prevSibling.uid; } );
    var updatePlanTreeNodeList = [];
    var newIndex = prevPlanIndex;

    // add Selected plan object
    updatePlanTreeNodeList.push( selectedTreeNode );

    let childCount = 0;

    if( loadedVMObjects[ selectedIndex ].children ) {
        childCount = addChildCount( loadedVMObjects[ selectedIndex ] );
        let lastChildInx = selectedIndex + childCount; // child starts from this index
        let firstChildIndex = selectedIndex + 1;

        // updated index of childrens of selected Plan object which is moved
        for( let i = firstChildIndex; i <= lastChildInx; i++ ) {
            updatePlanTreeNodeList.push( loadedVMObjects[ i ] );
        }
    }

    // remove plan from old index
    loadedVMObjects.splice( selectedIndex, childCount + 1 );

    // add moved plan objects and its children to its updated index
    for( let index = 0; index < updatePlanTreeNodeList.length; index++ ) {
        loadedVMObjects.splice( newIndex, 0, updatePlanTreeNodeList[ index ] );
        newIndex++;
    }

    // updated parent plan to its children attibute
    updateChildern( loadedVMObjects, selectedTreeNode, 'Pgp0MoveUp' );

    // updated plan objects to its childIndx attibute
    updateChildIndex( loadedVMObjects, selectedTreeNode, 'Pgp0MoveUp' );
};

/**
 * Function to perform move up operation
 *
 * @param {Array} loadedVMObjects VMO
 * @param {int} selectedIndex selected index of selected tree node
 * @param {object} selectedTreeNode selected tree node
 * @param {object} nextSibling  next sibling
 */
var performMoveDown = function( loadedVMObjects, selectedIndex, selectedTreeNode, nextSibling ) {
    var nextPlanIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === nextSibling.uid; } );
    var updatePlanTreeNodeList = [];
    var newIndex = nextPlanIndex;

    //if next sibling has child
    if( nextSibling.children ) {
        newIndex += addChildCount( nextSibling );
    }

    // add Selected plan object
    updatePlanTreeNodeList.push( selectedTreeNode );

    let childCount = 0;

    if( loadedVMObjects[ selectedIndex ].children ) {
        childCount = addChildCount( loadedVMObjects[ selectedIndex ] );
        let lastChildInx = selectedIndex + childCount; // child starts from this index
        let firstChildIndex = selectedIndex + 1;

        // updated index of children of selected Plan object which is moved
        for( let i = firstChildIndex; i <= lastChildInx; i++ ) {
            updatePlanTreeNodeList.push( loadedVMObjects[ i ] );
        }
    }

    // add moved plan objects and its children to its updated index
    for( let index = 0; index < updatePlanTreeNodeList.length; index++ ) {
        loadedVMObjects.splice( newIndex + 1, 0, updatePlanTreeNodeList[ index ] );
        newIndex++;
    }
    // remove plan from old index
    loadedVMObjects.splice( selectedIndex, childCount + 1 );

    // updated parent plan to its children attibute
    updateChildern( loadedVMObjects, selectedTreeNode, 'Pgp0MoveDown' );

    // updated plan objects to its childIndx attibute
    updateChildIndex( loadedVMObjects, selectedTreeNode, 'Pgp0MoveDown' );
};

/**
 * Updates child index of plan objects
 *
 * @param {Array} loadedVMObjects VMOs from view model collection.
 * @param {object} selectedTreeNode selected tree node
 * @param {String} activeMove  move can be either up or down
 */
var updateChildIndex = function( loadedVMObjects, selectedTreeNode, activeMove ) {
    // gets the prevsibling
    let parentNode = _.find( loadedVMObjects, vmo => vmo.uid === selectedTreeNode.parentNodeUid );
    if( parentNode.children ) {
        let children = parentNode.children;
        let childIndex = _.findIndex( children, function( vmNodeObj ) { return vmNodeObj.uid === selectedTreeNode.uid; } );
        var selected = children[ childIndex ];
        selected.childNdx = childIndex;
        if( activeMove === 'Pgp0MoveUp' ) {
            var nextPlan = children[ childIndex + 1 ]; //After reparenting it becomes next
            nextPlan.childNdx = childIndex + 1;
            if( selected.children ) {
                traverseIncreaseChildrenIndex( selected );
            }
        } else if( activeMove === 'Pgp0MoveDown' ) {
            var prevPlan = children[ childIndex - 1 ]; //After reparenting it becomes prev
            prevPlan.childNdx = childIndex - 1;
            if( selected.children ) {
                traverseIncreaseChildrenIndex( selected );
            }
        }
    }
};

/**
 * Updates children attribute of parent plan
 *
 * @param {Array} loadedVMObjects VMOs from view model collection.
 * @param {Object} selectedTreeNode selected tree node
 * @param {String} activeMove  move can be either up or down
 */
var updateChildern = function( loadedVMObjects, selectedTreeNode, activeMove ) {
    // gets the prevsibling
    let parentNode = _.find( loadedVMObjects, vmo => vmo.uid === selectedTreeNode.parentNodeUid );
    if( parentNode.children ) {
        let children = parentNode.children;
        let childIndex = _.findIndex( children, function( vmNodeObj ) { return vmNodeObj.uid === selectedTreeNode.uid; } );
        if( activeMove === 'Pgp0MoveUp' ) {
            children.splice( childIndex - 1, 0, children[ childIndex ] );
            children.splice( childIndex + 1, 1 );
        } else if( activeMove === 'Pgp0MoveDown' ) {
            children.splice( childIndex + 2, 0, children[ childIndex ] );
            children.splice( childIndex, 1 );
        }
    }
};

/**
 * gets the new previous sibling for selected plan object.
 *
 * @param {Object} vmCollection view model collection
 * @param {Object} selectedTreeNode selected tree node
 * @param {String} activeMove  move can be either up or down
 * @return {Object} vmNode A view model node object containing the details of the previous or next plan object.
 */
var getNewPreviousSibling = function( vmCollection, selectedTreeNode, activeMove ) {
    // gets the prevsibling
    let parentNode = _.find( vmCollection.loadedVMObjects, vmo => vmo.uid === selectedTreeNode.parentNodeUid );
    if( parentNode.children ) {
        let children = parentNode.children;
        let childIndex = _.findIndex( children, function( vmNodeObj ) { return vmNodeObj.uid === selectedTreeNode.uid; } );
        if( activeMove === 'Pgp0MoveUp' ) {
            // Selected node is going to be first child in Plan hirerachy.
            if( selectedTreeNode.childNdx === 1 ) {
                return {
                    type: 'unknownType',
                    uid: 'AAAAAAAAAAAAAA'
                };
            }
            // gets the new prevsibling
            return children[ childIndex - 2 ];
        }
        // gets the new prevsibling in MoveDown
        return children[ childIndex + 1 ];
    }
};

/**
 * gets the previous or next plan object
 *
 * @param {Object} vmCollection view model collection
 * @param {object} selectedTreeNode selected tree node
 * @param {String} activeMove  move can be either up or down
 * @return {Object} vmNode A view model node object containing the details of the previous or next plan object.
 */
var getPreviousOrNextPlanObject = function( vmCollection, selectedTreeNode, activeMove ) {
    // gets the prevsibling
    let parentNode = _.find( vmCollection.loadedVMObjects, vmo => vmo.uid === selectedTreeNode.parentNodeUid );
    if( parentNode.children ) {
        let children = parentNode.children;
        let childIndex = _.findIndex( children, function( vmNodeObj ) { return vmNodeObj.uid === selectedTreeNode.uid; } );
        if( activeMove === 'Pgp0MoveUp' ) {
            // gets the prevsibling
            return children[ childIndex - 1 ];
        }
        // gets the nextsibling
        return children[ childIndex + 1 ];
    }
};

/**
 * Updates children attribute of parent plan
 *
 * @param {object} treeDataProvider contains data provider for the tree table
 * @param {String} activeMove  move can be either up or down
 * @param {Object} movePlanObjectsInput  The move plan object input
 */
export let updateAndReturnPlanTreeNodePosition = function( treeDataProvider, activeMove, selection ) {
    if( treeDataProvider.viewModelCollection && treeDataProvider.viewModelCollection.loadedVMObjects && treeDataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        let selectedPlan = selection.selected[ 0 ];
        let loadedVMObjects = treeDataProvider.viewModelCollection.loadedVMObjects;
        let selectedIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === selectedPlan.uid; } );
        var selectedTreeNode = treeDataProvider.viewModelCollection.getViewModelObject( selectedIndex );
        let sibling = getPreviousOrNextPlanObject( treeDataProvider.viewModelCollection, selectedTreeNode, activeMove );
        if( activeMove === 'Pgp0MoveUp' && selectedIndex > -1 ) {
            performMoveUp( loadedVMObjects, selectedIndex, selectedTreeNode, sibling );
        } else if( activeMove === 'Pgp0MoveDown' && selectedIndex > -1 ) {
            performMoveDown( loadedVMObjects, selectedIndex, selectedTreeNode, sibling );
        }
        treeDataProvider.update( loadedVMObjects );
        return {
            planUid: selectedTreeNode.uid,
            index: selectedTreeNode.childNdx,
            parentUid: sibling.parentNodeUid
        };
    }
    return null;
};

/**
 * Get the move plan object Info and prepare the input for movePlanObjects SOA.
 *
 * @param {data} data - The data of view model
 * @return {Object} movePlanObjectsInput - The move plan object input
 */
export let getMovePlanObjectsInput = function( data ) {
    var movePlanObjectsInput = [];

    if( data.dataProviders && data.dataProviders.planNavigationTreeDataProvider && data.dataProviders.planNavigationTreeDataProvider.selectedObjects.length > 0 ) {
        var planNavigationTreeDataProvider = data.dataProviders.planNavigationTreeDataProvider;
        var selectedPlanObject = planNavigationTreeDataProvider.selectedObjects[ 0 ];
        if( selectedPlanObject && planNavigationTreeDataProvider.viewModelCollection ) {
            var prevSibling = getNewPreviousSibling( planNavigationTreeDataProvider.viewModelCollection, selectedPlanObject, data.eventMap.movePlanObjectsEvent.activeMove );
            var newParent = {
                type: 'unknownType',
                uid: 'AAAAAAAAAAAAAA'
            };
            if( prevSibling.type !== 'unknownType' ) {
                prevSibling = cdm.getObject( prevSibling.uid );
            }
            var movePlanObjectInput = {
                plan: cdm.getObject( selectedPlanObject.uid ),
                newParent: newParent,
                prevSibling: prevSibling
            };
            movePlanObjectsInput.push( movePlanObjectInput );
        }
    }
    data.movePlanObjectsInput = movePlanObjectsInput;
    return movePlanObjectsInput;
};

export default exports = {
    getMovePlanObjectsInput,
    getMovePlanObjects,
    updateAndReturnPlanTreeNodePosition
};
