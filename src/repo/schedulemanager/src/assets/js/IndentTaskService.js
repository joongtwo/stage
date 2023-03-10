// Copyright (c) 2022 Siemens

/**
 * @module js/IndentTaskService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import userListService from 'js/userListService';

var exports = {};

var prepareIndentTaskErrorMessage = function( taskNotToBeUpdated, statesMessage, selection ) {
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    var finalMessage = messagingService.applyMessageParams( localTextBundle.invalidIndentErrorMsg, [ '{{numberOfTasks}}' ], {
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
 * Get the validation for indent task and prepare the input for moveTask SOA.
 *
 * @param {Array} selectedTasks Primary work area selections
 * @return {Object} moveRequests move tasks SOA input
 */
export let getIndentValidation = function( selectedTasks ) {
    if( !_.isArray( selectedTasks ) ) {
        return [];
    }
    const localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );
    const { taskNotToBeUpdated, statesMessage } = userListService.getTasksNotToBeUpdated( selectedTasks, true );

    //This array will contains Uids of task whose parent is selected
    let selectionsToExclude = [];
    let selectedTasksUids = [];
    var moveRequests = [];
    var tasksToProcess = [];

    selectedTasks.forEach( seletcedTask => selectedTasksUids.push( seletcedTask.uid ) );
    var parent;
    selectedTasks.forEach( function( seletcedTask ) {
        var parentTaskProp = seletcedTask.props.fnd0ParentTask;
        var parentTask = cdm.getObject( parentTaskProp.dbValues[ 0 ] );
        appCtxSvc.updateCtx( 'oldParentUidForIndentOperation', parentTask.uid );
        if( !parentTask ) {
            message = prepareIndentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
            messagingService.showError( message );
            throw '';
        }

        let isParentSelected = selectedTasksUids.indexOf( parentTaskProp.dbValues[ 0 ] );
        if( isParentSelected !== -1 ) {
            selectionsToExclude.push( seletcedTask.uid );
        } else {
            if( parent === undefined ) {
                parent = parentTask;
                tasksToProcess.push( seletcedTask.uid );
            } else if( parent === parentTask ) {
                tasksToProcess.push( seletcedTask.uid );
            } else {
                var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionErrorMessage, [ '{{numberOfTasks}}' ], {
                    numberOfTasks: selectedTasks.length
                } );
                messagingService.showError( message );
                throw '';
            }
        }
    } );

    var childTasks = parent.props.child_task_taglist;

    var newParent = null;
    let taskIndex = {};
    let indexArray = [];
    tasksToProcess.forEach( function( selected ) {
        if( childTasks.dbValues.indexOf( selected ) === -1 ) {
            var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionErrorMessage, [ '{{numberOfTasks}}' ], {
                numberOfTasks: selectedTasks.length
            } );
            messagingService.showError( message );
            throw '';
        }
        indexArray.push( childTasks.dbValues.indexOf( selected ) );
        taskIndex[ childTasks.dbValues.indexOf( selected ) ] = selected;
    } );
    indexArray.sort( function( a, b ) { return a - b; } );
    for( const index in indexArray ) {
        if( indexArray[ index ] - indexArray[ index - 1 ] > 1 ) {
            var message = messagingService.applyMessageParams( localTextBundle.noContinousSelectionErrorMessage, [ '{{numberOfTasks}}' ], {
                numberOfTasks: selectedTasks.length
            } );
            messagingService.showError( message );
            throw '';
        }
    }

    let topChild = taskIndex[ indexArray[ 0 ] ];
    var topChildProp = cdm.getObject( topChild );
    var parentTaskProp = topChildProp.props.fnd0ParentTask;
    var parentTask = cdm.getObject( parentTaskProp.dbValues[ 0 ] );
    var childTasksProp = parentTask.props.child_task_taglist;
    let parentIndex = childTasksProp.dbValues.indexOf( topChild );
    if( parentIndex === 0 ) {
        message = prepareIndentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
        messagingService.showError( message );
        throw '';
    }

    newParent = cdm.getObject( childTasksProp.dbValues[ parentIndex - 1 ] );

    if( newParent !== null ) {
        var newParentTask = {
            type: newParent.type,
            uid: newParent.uid
        };
    }
    var prevSiblingTask = {
        type: 'unknownType',
        uid: 'AAAAAAAAAAAAAA'
    };
    indexArray.forEach( function( index ) {
        var isExcluded = selectionsToExclude.indexOf( taskIndex[ index ] ) > -1;
        if( !isExcluded ) {
            //Summary Task cannot be indented.
            var seletcedTask = cdm.getObject( taskIndex[ index ] );
            if( seletcedTask.props.task_type.dbValues[ 0 ] === 6 ) {
                message = prepareIndentTaskErrorMessage( statesMessage, taskNotToBeUpdated, selectedTasks );
                messagingService.showError( message );
                throw '';
            }

            var moveRequest;
            var taskToIndent = {
                type: seletcedTask.type,
                uid: seletcedTask.uid
            };

            if( typeof newParent !== typeof undefined && prevSiblingTask.type !== 'unknownType' ) {
                moveRequest = {
                    task: taskToIndent,
                    newParent: newParentTask,
                    prevSibling: prevSiblingTask
                };
                moveRequests.push( moveRequest );
            } else {
                moveRequest = {
                    task: taskToIndent,
                    newParent: newParentTask
                };
                moveRequests.push( moveRequest );
            }
            prevSiblingTask = {
                type: seletcedTask.type,
                uid: seletcedTask.uid
            };
        }
    } );
    appCtxSvc.updateCtx( 'IsIndentCommandActive', true );
    return moveRequests;
};

export let getParentTaskObject = function( selectedTasks ) {
    let parentTaskObj;
    let parent = selectedTasks[ 0 ].props.fnd0ParentTask;
    if( parent ) {
        parentTaskObj = cdm.getObject( parent.dbValues[ 0 ] );
    }
    return parentTaskObj;
};

/**
 * Function to perform indent operation
 * @param {Object} treeDataProvider schedule tree data provider
 * @param {object} eventData eventdata with parent child information
 */
export let performIndentAction = function( treeDataProvider, eventData ) {
    let loadedVMObjects = treeDataProvider.viewModelCollection.loadedVMObjects;
    let oldParentUid = appCtxSvc.getCtx( 'oldParentUidForIndentOperation' );
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
    // Now get all the tasks including proxy tasks which need to be indented
    let allTasksToIndent = [];
    if( selectedObjects && selectedObjects.length > 0 ) {
        for( let i = 0; i < selectedObjects.length; i++ ) {
            allTasksToIndent.push( selectedObjects[i] );
            let idx = selectedObjects[i].index + 1;
            while( idx < loadedVMObjects.length && loadedVMObjects[idx].modelType.typeHierarchyArray.indexOf( 'Fnd0ProxyTask' ) !== -1 ) {
                loadedVMObjects[idx].index = idx;
                allTasksToIndent.push( loadedVMObjects[idx] );
                idx++;
            }
        }
        allTasksToIndent.sort( ( vmo1, vmo2 ) => vmo1.index > vmo2.index ? 1 : -1 );
    }

    if( allTasksToIndent && allTasksToIndent.length > 0 ) {
        removeSelectedNodesFromTree( allTasksToIndent, loadedVMObjects, treeDataProvider, selectedTreeNodesMap, oldParentUid );

        let newParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === newParentUid; } );
        let newParentTreeNode = loadedVMObjects[ newParentTreeNodeIndex ];

        // if new parent is leaf node
        if( newParentTreeNode.isLeaf ) {
            newParentTreeNode.isLeaf = false;
            newParentTreeNode.isExpanded = true;
            newParentTreeNode.cursorObject = {
                endReached: true,
                startReached: true
            };
            addSelectedNodesToNewParentTreeNode( newParentTreeNode, allTasksToIndent, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects );
        } else {
            // if new parent is fully expanded
            if( newParentTreeNode.isExpanded && newParentTreeNode.cursorObject && newParentTreeNode.cursorObject.endReached ) {
                addSelectedNodesToNewParentTreeNode( newParentTreeNode, allTasksToIndent, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects );
            } else if( newParentTreeNode.__expandState ) {
                delete newParentTreeNode.__expandState;
            }
        }
    }

    //ganttUtils.moveGanttTask( siblingTaskObj.task, siblingTaskObj.prevIndex, parentUid );
    appCtxSvc.unRegisterCtx( 'oldParentUidForIndentOperation' );
    appCtxSvc.unRegisterCtx( 'IsIndentCommandActive' );
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
 * @param {String} oldParentUid - uid of old parent tree node
 */
let removeSelectedNodesFromTree = function( selectedObjects, loadedVMObjects, treeDataProvider, selectedTreeNodesMap, oldParentUid ) {
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
        let oldParentTreeNodeIndex = _.findIndex( loadedVMObjects, function( vmNodeObj ) { return vmNodeObj.uid === oldParentUid; } );
        let oldParentTreeNode = loadedVMObjects[ oldParentTreeNodeIndex ];

        // remove entry of selected node from children property of old parent tree node
        if( oldParentTreeNode && oldParentTreeNode.children ) {
            let childIndex = _.findIndex( oldParentTreeNode.children, function( vmNodeObj ) { return vmNodeObj.uid === selectedTreeNode.uid; } );
            oldParentTreeNode.children.splice( childIndex, 1 );
        }
    }
};

/**
 * Function to add selected nodes and its children after its new parent node
 *
 * @param {Object} newParentTreeNode - new parent tree node
 * @param {Array} selectedObjects - selected objects
 * @param {Map} selectedTreeNodesMap - map with selected nodes and its children information
 * @param {Number} newParentTreeNodeIndex - index of new parent
 * @param {Array} loadedVMObjects - array of View model objects
 */
let addSelectedNodesToNewParentTreeNode = function( newParentTreeNode, selectedObjects, selectedTreeNodesMap, newParentTreeNodeIndex, loadedVMObjects ) {
    for( let i = 0; i < selectedObjects.length; i++ ) {
        let newParentNestedChildCount = 0;
        if( newParentTreeNode.children ) {
            newParentNestedChildCount = addChildCount( newParentTreeNode );
        }
        let selectedTreeNode = selectedObjects[ i ];
        // add selected object and its nested children to new index
        if( selectedTreeNodesMap[ selectedTreeNode.uid ] ) {
            let updatedTreeNodeList = selectedTreeNodesMap[ selectedTreeNode.uid ];
            if( updatedTreeNodeList.length > 0 ) {
                let updatedTreeNodeChildIndex = newParentTreeNodeIndex + newParentNestedChildCount + 1;
                for( let index = 0; index < updatedTreeNodeList.length; index++ ) {
                    updatedTreeNodeList[ index ].levelNdx += 1;
                    loadedVMObjects.splice( updatedTreeNodeChildIndex, 0, updatedTreeNodeList[ index ] );
                    updatedTreeNodeChildIndex++;
                }
            }
        }
        // assign new parent node and add entry selected objects into children property of new parent node
        selectedTreeNode.parentNodeUid = newParentTreeNode.uid;
        if( newParentTreeNode.children && newParentTreeNode.children.length > 0 ) {
            selectedTreeNode.childNdx = newParentTreeNode.children.length;
            newParentTreeNode.children.push( selectedTreeNode );
        } else {
            selectedTreeNode.childNdx = 0;
            newParentTreeNode.children = [ selectedTreeNode ];
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
    getIndentValidation,
    getParentTaskObject,
    performIndentAction
};

export default exports;
