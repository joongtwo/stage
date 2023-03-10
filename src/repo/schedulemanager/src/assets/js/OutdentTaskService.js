// Copyright (c) 2022 Siemens

/**
 * @module js/OutdentTaskService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import messagingService from 'js/messagingService';
import userListService from 'js/userListService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';

var exports = {};

var prepareOutdentTaskErrorMessage = function( taskNotToBeUpdated, statesMessage, selection ) {
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    var finalMessage = messagingService.applyMessageParams( localTextBundle.invalidOutdentErrorMsg, [ '{{numberOfTasks}}' ], {
        numberOfTasks: selection.length
    } );

    if( taskNotToBeUpdated.length > 0 ) {
        finalMessage = messagingService.applyMessageParams( localTextBundle.smPreventUpdatePrefErrorMessge, [ '{{states}}' ], {
            states: statesMessage
        } );

        taskNotToBeUpdated.forEach( function( task ) {
            finalMessage += '\n';
            let message = localTextBundle.singleTaskDeleteErrorMessage;
            message = messagingService.applyMessageParams( localTextBundle.singleTaskDeleteErrorMessage, [ '{{taskName}}', '{{taskStatus}}' ], {
                taskName: task.name,
                taskStatus: task.status
            } );
            finalMessage += message;
        } );
    }
    return finalMessage;
};

/**
 * Get the validation for Outdent task and prepare the input for moveTask SOA.
 *
 * @param {Object} selectedTasks Primary work area selections
 * @return {Object} moveRequests move tasks SOA input
 */
export let getOutdentValidation = function( selectedTasks ) {
    if( !_.isArray( selectedTasks ) ) {
        return [];
    }

    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    const { taskNotToBeUpdated, statesMessage } = userListService.getTasksNotToBeUpdated( selectedTasks, false );

    let selectionsToExclude = [];
    var tasksToProcess = [];
    var moveRequests = [];

    selectedTasks.sort( ( task1, task2 ) => {
        if( task1.childNdx >= 0 && task2.childNdx >= 0 ) {
            return task1.childNdx - task2.childNdx;
        }
        return -1;
    } );

    let selectedTasksUids = selectedTasks.map( ( task ) => task.uid );
    var parent;
    var message = '';
    selectedTasks.forEach( function( seletcedTask ) {
        var parentTaskProp = seletcedTask.props.fnd0ParentTask;
        var parentTask = cdm.getObject( parentTaskProp.dbValues[ 0 ] );
        appCtxSvc.updateCtx( 'oldParentUidForOutdentOperation', parentTask.uid );
        if( !parentTask ) {
            message = prepareOutdentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
            messagingService.showError( message );
            throw '';
        }

        let isParentSelected = selectedTasksUids.indexOf( parentTaskProp.dbValues[ 0 ] );
        if( !isParentSelected ) {
            selectionsToExclude.push( seletcedTask.uid );
        } else {
            if( parent === undefined ) {
                parent = parentTask;
                tasksToProcess.push( seletcedTask.uid );
            } else if( parent === parentTask ) {
                tasksToProcess.push( seletcedTask.uid );
            } else {
                var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionOutdentErrorMsg, [ '{{numberOfTasks}}' ], {
                    numberOfTasks: selectedTasks.length
                } );
                messagingService.showError( message );
                throw '';
            }
        }
    } );

    var superParentTask = cdm.getObject( parent.props.fnd0ParentTask.dbValues[ 0 ] );

    // This is an immediate child of Schedule Summary Task that cannot be outdented.
    if( superParentTask === null || typeof superParentTask === typeof undefined ) {
        message = prepareOutdentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
        messagingService.showError( message );
        throw '';
    }

    var newParentTask = {
        type: superParentTask.type,
        uid: superParentTask.uid
    };
    var prevSiblingTask = {
        type: parent.type,
        uid: parent.uid
    };

    for( let index = 0; index < selectedTasks.length; index++ ) {
        let selectedTask = selectedTasks[ index ];
        var isExcluded = selectionsToExclude.indexOf( selectedTask.uid ) > -1;
        if( !isExcluded ) {
            var taskToOutdent = {
                type: selectedTask.type,
                uid: selectedTask.uid
            };

            var moveRequest = {
                task: taskToOutdent,
                newParent: newParentTask,
                prevSibling: prevSiblingTask
            };
            if( index > 0 ) {
                moveRequest.prevSibling = selectedTasks[ index - 1 ];
            }
            moveRequests.push( moveRequest );
        }
    }
    appCtxSvc.updateCtx( 'isOutdentCommandActive', true );
    return moveRequests;
};

/**
 * Function to perform outdent operation
 * @param {Object} treeDataProvider schedule tree data provider
 * @param {object} eventData eventdata with parent child information
 */
export let performOutdentAction = function( treeDataProvider, eventData ) {
    let loadedVMObjects = treeDataProvider.viewModelCollection.loadedVMObjects;
    let oldParentUid = appCtxSvc.getCtx( 'oldParentUidForOutdentOperation' );
    let newParentUid = eventData.newParent.uid;
    let selectedTreeNodesMap = {};
    let selectedObjects = treeDataProvider.getSelectedObjects();

    // sort selected objects in ascending order using index
    if( selectedObjects && selectedObjects.length > 0 ) {
        for( let i = 0; i < selectedObjects.length; i++ ) {
            let selectedTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === selectedObjects[ i ].uid; } );
            selectedObjects[ i ].index = selectedTreeNodeIndex;
        }
        selectedObjects.sort( ( vmo1, vmo2 ) => vmo1.index > vmo2.index ? 1 : -1 );
    }
    // Now get all the tasks including proxy tasks which need to be outdented
    let allTasksToOutdent = [];
    if( selectedObjects && selectedObjects.length > 0 ) {
        for( let i = 0; i < selectedObjects.length; i++ ) {
            allTasksToOutdent.push( selectedObjects[i] );
            let idx = selectedObjects[i].index + 1;
            while( idx < loadedVMObjects.length && loadedVMObjects[idx].modelType.typeHierarchyArray.indexOf( 'Fnd0ProxyTask' ) !== -1 && loadedVMObjects[idx].levelNdx === selectedObjects[i].levelNdx ) {
                loadedVMObjects[idx].index = idx;
                allTasksToOutdent.push( loadedVMObjects[idx] );
                idx++;
            }
        }
        allTasksToOutdent.sort( ( vmo1, vmo2 ) => vmo1.index > vmo2.index ? 1 : -1 );
    }

    if( allTasksToOutdent && allTasksToOutdent.length > 0 ) {
        let oldParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === oldParentUid; } );
        let oldParentTreeNode = loadedVMObjects[ oldParentTreeNodeIndex ];
        removeSelectedNodesFromTree( allTasksToOutdent, loadedVMObjects, treeDataProvider, selectedTreeNodesMap, oldParentTreeNode );
        let newParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === newParentUid; } );
        let newParentTreeNode = loadedVMObjects[ newParentTreeNodeIndex ];

        let oldGrandParentUid = oldParentTreeNode.parentNodeUid;
        let oldGrandParentNode = loadedVMObjects.find( element => element.uid === oldGrandParentUid );
        if( oldGrandParentNode.children ) {
            let oldParentIndex = oldGrandParentNode.children.findIndex( element => element.uid === oldParentTreeNode.uid );
            // if old parent's sibling is available or new parent is fully expanded
            if( oldParentIndex < oldGrandParentNode.children.length ||  newParentTreeNode.cursorObject && newParentTreeNode.cursorObject.endReached ) {
                addSelectedNodesToNewParentTreeNode( treeDataProvider, newParentTreeNode, allTasksToOutdent, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects, oldParentTreeNode );
            }
        }
    }

    let updatedTaskRowIds = [];
    for( let index = 0; index < loadedVMObjects.length; index++ ) {
        updatedTaskRowIds.push( loadedVMObjects[ index ].id );
    }
    appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids = updatedTaskRowIds;

    appCtxSvc.unRegisterCtx( 'oldParentUidForOutdentOperation' );
    appCtxSvc.unRegisterCtx( 'isOutdentCommandActive' );
    // to avoid flaky issue,sometimes even all tree node propeties has correct values it does not update the tree node positions
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
};

/**
 * Function to remove selected nodes and its childrens from tree
 *
 * @param {Array} selectedObjects - selected objects
 * @param {Array} loadedVMObjects - array of View model objects
 * @param {Object} treeDataProvider schedule tree data provider
 * @param {Map} selectedTreeNodesMap - map with selected nodes and its children information
 * @param {Object} oldParentTreeNode - old parent tree node
 */
let removeSelectedNodesFromTree = function( selectedObjects, loadedVMObjects, treeDataProvider, selectedTreeNodesMap, oldParentTreeNode ) {
    for( let i = 0; i < selectedObjects.length; i++ ) {
        let updatedTreeNodeList = [];
        let childCount = 0;
        if( selectedObjects[ i ].index ) {
            delete selectedObjects[ i ].index;
        }
        updatedTreeNodeList.push( selectedObjects[ i ] );
        let selectedTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === selectedObjects[ i ].uid; } );
        let selectedTreeNode = loadedVMObjects[ selectedTreeNodeIndex ];
        if( selectedTreeNode.children ) {
            childCount = addChildCount( selectedTreeNode );
            let lastChildInx = selectedTreeNodeIndex + childCount; // child starts from this index
            let firstChildIndex = selectedTreeNodeIndex + 1;
            // updated index of childrens of selected Plan object which is moved
            for( let j = firstChildIndex; j <= lastChildInx; j++ ) {
                updatedTreeNodeList.push( loadedVMObjects[ j ] );
            }
        }
        selectedTreeNodesMap[ selectedTreeNode.uid ] = updatedTreeNodeList;

        // remove selected task using old index
        loadedVMObjects.splice( selectedTreeNodeIndex, childCount + 1 );

        // remove entry of selected node from children property of old parent tree node
        if( oldParentTreeNode && oldParentTreeNode.children ) {
            let childIndex = _.findIndex( oldParentTreeNode.children, function( vmNodeObj ) { return vmNodeObj.uid === selectedTreeNode.uid; } );
            oldParentTreeNode.children.splice( childIndex, 1 );
            if( oldParentTreeNode.children.length === 0 ) {
                oldParentTreeNode.isLeaf = true;
            }
        }
    }
};

/**
 * Function to add selected nodes and its children after its new parent node
 * @param {Object} treeDataProvider schedule tree data provider
 * @param {Object} newParentTreeNode - new parent tree node
 * @param {Array} selectedObjects - selected objects
 * @param {Map} selectedTreeNodesMap - map with selected nodes and its children information
 * @param {Number} newParentTreeNodeIndex - index of new parent
 * @param {Array} loadedVMObjects - array of View model objects
 * @param {Object} oldParentTreeNode -  old parent tree node
 */
let addSelectedNodesToNewParentTreeNode = function( treeDataProvider, newParentTreeNode, selectedObjects, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects, oldParentTreeNode ) {
    let oldParentNestedChildCount = 0;
    if( oldParentTreeNode.children ) {
        oldParentNestedChildCount = addChildCount( oldParentTreeNode );
    }
    let oldParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === oldParentTreeNode.uid; } );

    // new index of selected nodes and its nested childrens
    let updatedIndex = oldParentTreeNodeIndex + oldParentNestedChildCount + 1;

    // new index of selected nodes in children attribute of its new parent tree node
    let updatedChildIndex = _.findIndex( newParentTreeNode.children, function( vmNodeObj ) { return vmNodeObj.uid === oldParentTreeNode.uid; } ) + 1;

    for( let i = 0; i < selectedObjects.length; i++ ) {
        let selectedTreeNode = selectedObjects[ i ];

        // Add selected object and its nested children to new index
        if( selectedTreeNodesMap[ selectedTreeNode.uid ] ) {
            let updatedTreeNodeList = selectedTreeNodesMap[ selectedTreeNode.uid ];
            if( updatedTreeNodeList.length > 0 ) {
                for( let index = 0; index < updatedTreeNodeList.length; index++ ) {
                    updatedTreeNodeList[ index ].levelNdx -= 1;
                    loadedVMObjects.splice( updatedIndex, 0, updatedTreeNodeList[ index ] );
                    updatedIndex++;
                }
            }
        }

        // assign new parent node and add entry selected objects into children property of new parent node
        selectedTreeNode.parentNodeUid = newParentTreeNode.uid;
        if( newParentTreeNode.children && newParentTreeNode.children.length > 0 ) {
            selectedTreeNode.childNdx = updatedChildIndex;
            newParentTreeNode.children.splice( updatedChildIndex, 0, selectedTreeNode );
            updatedChildIndex++;
        }
    }
};

/**
 * Get number of nested child
 *
 * @param {Array} vmNode - selected vmNode
 * @returns {Number} The number of nested chiild
 */
let addChildCount = function( vmNode ) {
    let index = 0;
    if( vmNode.children && vmNode.children.length > 0 ) {
        index += vmNode.children.length;
        vmNode.children.forEach( ( child ) => {
            index += addChildCount( child );
        } );
    }
    return index;
};

exports = {
    getOutdentValidation,
    performOutdentAction
};

export default exports;
