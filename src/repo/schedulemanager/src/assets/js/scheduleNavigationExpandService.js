// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/scheduleNavigationExpandService
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import _awTableStateSvc from 'js/awTableStateService';

let exports;
/**
 * Function to perform expand operation for selected task which includes nested childrens
 * @param {Object} treeNode selected tree node to expand
 * @param {Object} declViewModel data object
 */
export let performExpandBelow = ( treeNode, declViewModel ) => {
    if( !treeNode || treeNode.isLeaf ) {
        return;
    }

    treeNode.isInExpandBelowMode = true;
    // if selected object is not leaf node and its childrens are already loaded
    if( treeNode.__expandState ) {
        let childNodeList = [];
        getChilNodeListToNLevel( treeNode, childNodeList );
        eventBus.publish( 'scheduleNavigationTreeDataProvider.expandTreeNode', {
            parentNode: {
                id: treeNode.uid
            }
        } );

        if( childNodeList && childNodeList.length > 0 ) {
            expandFirstLevelChildren( childNodeList, declViewModel );
        }
    } else if( !treeNode.__expandState ) {
        // if selected node is already expanded
        if( treeNode.isExpanded && treeNode.children && treeNode.children.length > 0 ) {
            eventBus.publish( 'scheduleNavigationTree.plTable.toggleTreeNode', treeNode );
            expandFirstLevelChildren( treeNode.children, declViewModel );
        } else {
            // if selected object is not leaf node and its childrens are not loaded
            eventBus.publish( 'scheduleNavigationTreeDataProvider.expandTreeNode', {
                parentNode: {
                    id: treeNode.uid
                }
            } );
        }
    }
};

/**
 * Function to perform collapse operation for selected task
 * @param {Object} treeNode selected tree node to collapse
 * @param {Object} treeDataProvider tree data provider
 * @param {Object} declViewModel data object
 */
export let performCollapseBelow = ( treeNode, treeDataProvider, declViewModel ) => {
    if( !treeNode ) {
        return;
    }
    let nodesInfo = getApplicableNodesInfoForCollapse( treeNode.children, treeDataProvider );
    let nodesToCollapse = nodesInfo.nodes;
    while( nodesInfo.children.length ) {
        nodesInfo = getApplicableNodesInfoForCollapse( nodesInfo.children, treeDataProvider );
        nodesToCollapse = nodesToCollapse.concat( nodesInfo.nodes );
    }

    nodesToCollapse.reverse().map( ( vmo ) => _awTableStateSvc.saveRowCollapsed( declViewModel, 'scheduleNavigationTree', vmo ) );

    delete treeNode.isExpanded;
    treeNode.isInExpandBelowMode = false;
    eventBus.publish( 'scheduleNavigationTree.plTable.toggleTreeNode', treeNode );
    delete treeNode.__expandState;
};

/**
 * Function to get nested childrens information which is to collapse
 * @param {Array} vmoNodes array of viewModelObjects
 * @param {Object} treeDataProvider data provider object.
 * @returns {Object} nodesInfo
 */
let getApplicableNodesInfoForCollapse = function( vmoNodes, treeDataProvider ) {
    let nodesInfo = {
        nodes: [],
        children: []
    };
    vmoNodes && vmoNodes.forEach( ( vmoNode ) => {
        if( _awTableStateSvc.isNodeExpanded( treeDataProvider.ttState, vmoNode ) ) {
            nodesInfo.nodes.push( vmoNode );
            if( vmoNode.children && vmoNode.children.length > 0 ) {
                nodesInfo.children = nodesInfo.children.concat( vmoNode.children );
            }
        }
    } );
    return nodesInfo;
};

/**
 * Get chid node list up to N level
 * @param {Object} parentVMO parent viewModelTree Node
 * @param {Array} childNodeList list of child objects
 */
let getChilNodeListToNLevel = function( parentVMO, childNodeList ) {
    _.forEach( parentVMO.__expandState.expandedNodes, function( node ) {
        if( !node.isLeaf ) {
            if( !node.__expandState ) {
                childNodeList.push( node );
            } else {
                if( node.__expandState.expandedNodes ) {
                    getChilNodeListToNLevel( node, childNodeList );
                }
            }
        }
    } );
};

/**
 * Expand children upto first level
 * @param {Object} childNodes child viewModelTreeNode objects
 * @param {Object} declViewModel data object
 */
let expandFirstLevelChildren = function( childNodes, declViewModel ) {
    childNodes && childNodes.forEach( childNode => {
        if( !childNode.isLeaf ) {
            childNode.isInExpandBelowMode = true;
            _awTableStateSvc.saveRowExpanded( declViewModel, 'scheduleNavigationTree', childNode );
            if( childNode.isExpanded && childNode.children && childNode.children.length > 0 ) {
                eventBus.publish( 'scheduleNavigationTree.plTable.toggleTreeNode', childNode );
                expandFirstLevelChildren( childNode.children, declViewModel );
            }
        }
    } );
};

exports = {
    performExpandBelow,
    performCollapseBelow
};

export default exports;
