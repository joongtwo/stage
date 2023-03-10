// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle common utility method execution only.
 *
 * @module js/createTaskService
 */
import selectionService from 'js/selection.service';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};
var createTaskData = {};

export let doTaskPanelInit = function( data ) {
    var newSharedData = {};
    if( typeof data !== 'undefined' && typeof data.newSharedData !== 'undefined' ) {
        newSharedData = _.clone( data.sharedData );
    }
    newSharedData.addedSourceObjects = [];
    newSharedData.activeView = 'tcxSimplifiedCreateDoTaskSub';
    return {
        sharedData: newSharedData
    };
};

export let openTaskAttachmentPanel = ( data, sharedData ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'tcxSimplifiedCreateTaskAttachmentSub';
    newSharedData.previousView = 'tcxSimplifiedCreateDoTaskSub';
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export const backToCreateTaskActionData = ( sharedData ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'tcxSimplifiedCreateDoTaskSub';
    newSharedData.previousView = 'tcxSimplifiedCreateTaskAttachmentSub';
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export let updateSharedDataWithTargets = function( sharedData, sourceObjects ) {
    var isDuplicateEntry = false;
    const newSharedData = { ...sharedData.value };
    if ( sharedData.addedSourceObjects && sharedData.addedSourceObjects.length ) {
        for( var j = 0; j <  sharedData.addedSourceObjects.length; j++ ) {
            if( sharedData.value.addedSourceObjects[ j ].uid === sourceObjects[ 0 ].uid  ) {
                // Duplicate object added.
                isDuplicateEntry = true;
            }
        }
    }

    // In case of back navigation
    if ( !sharedData.value.addedSourceObjects ) {
        sharedData.value.addedSourceObjects = [];
    }

    if ( !isDuplicateEntry || sharedData.value.addedSourceObjects.length === 0 ) {
        newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects, ...sourceObjects ];
    }
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

/**
 * Remove given attachment from attachment list.
 *
 * @param {String} data - The view model data
 * @param {String} attachment - The attachment to be removed
 */
export let removeTargetAttachment = function( context ) {
    const localContext = { ...context };
    const newSharedData = localContext.createContext.sharedData.value;
    const targets = localContext.targetContextObject;
    const selectedObject = localContext.selectedObject;
    for( let j = 0; j <  targets.modelObjects.length; j++ ) {
        if( targets.modelObjects[ j ].uid === selectedObject[0].uid  ) {
            targets.modelObjects.splice( j, 1 );
        }
    }
    var targetUid;
    if ( selectedObject[0].props.awb0UnderlyingObject ) {
        targetUid = selectedObject[0].props.awb0UnderlyingObject.dbValues[0];
    } else {
        targetUid = selectedObject[0].uid;
    }
    for( let j = 0; j < newSharedData.addedSourceObjects.length; j++ ) {
        if( newSharedData.addedSourceObjects[ j ].uid === targetUid  ) {
            newSharedData.addedSourceObjects.splice( j, 1 );
        }
    }
    context.update && context.update( localContext );
    eventBus.publish( 'createTask.reloadTargetDataProvider' );
};

/**
  * @param {*} taskName the existing task name
  * @param {*} selectedObj the selected object string
  * @returns {str} updated taskName
  */
export let setTaskName = function( taskName, selectedObj ) {
    taskName.dbValue += selectedObj;
    return taskName;
};

export let setCreateTaskState = function( taskName, priority, dueDate, instructions, sharedData ) {
    if( sharedData.value.previousView === 'tcxSimplifiedCreateTaskAttachmentSub' ) {
        taskName = createTaskData.taskName;
        priority = createTaskData.priority;
        dueDate = createTaskData.dueDate;
        instructions = createTaskData.instructions;
    }
    return {
        taskName,
        priority,
        dueDate,
        instructions
    };
};

/**
  * Return the input model object array UID array
  *
  * @param {Object} targetObjects Attached target objects
  * @return {StringArray} UID's string array
  */
export let getTargetUids = function( targetObjects ) {
    var uids = [];
    var attachmentList = [];
    uids = _getAttachmentObjectUids( targetObjects.modelObjects, uids );
    attachmentList = uids.concat( attachmentList );
    return attachmentList;
};

/**
  * Return the attachment types
  *
  * @param {Object} targetObjects Attached target objects
  * @return {StringArray} attachment types
  */
export let getAttachmentTypes = function( targetObjects ) {
    var attachmentTypes = [];
    if( targetObjects ) {
        for( var idx = 0; idx < targetObjects.modelObjects.length; idx++ ) {
            attachmentTypes.push( 1 );
        }
    }
    return attachmentTypes;
};

/**
  * Populate the Uids that need to be added as attachments.
  *
  * @param {Array} modelObjects Model objects that need to be added
  * @param {Array} uidList Uid list that will be added as attachment
  * @returns {Array} Final Uids array that will be added as attachment.
  */
var _getAttachmentObjectUids = function( modelObjects, uidList ) {
    var uids = _.clone( uidList );
    if ( modelObjects && !_.isEmpty( modelObjects ) ) {
        for ( var x in modelObjects ) {
            if ( modelObjects[x] ) {
                var targetUid;
                if ( modelObjects[x].props.awb0UnderlyingObject ) {
                    targetUid = modelObjects[x].props.awb0UnderlyingObject.dbValues[0];
                } else {
                    targetUid = modelObjects[x].uid;
                }
                if ( targetUid ) {
                    uids.push( targetUid );
                }
            }
        }
    }
    return uids;
};

/** Get the EPM Task started for the EPM Job created from the Create Instance SOA response
 *
 * @param {*} allModelObjects The model objects from the SOA response
 * @returns {*} The task object created
 */
export let getTaskObject = function( allModelObjects ) {
    for ( let objectId in allModelObjects ) {
        const type = allModelObjects[objectId].type;
        const startedTask = allModelObjects[objectId].props.fnd0StartedTasks;
        if ( type === 'EPMTask' && startedTask && startedTask.dbValues[0] !== null ) {
            const uid = startedTask.dbValues[0];
            return {
                uid: uid,
                type: 'EPMDoTask'
            };
        }
    }
    return {};
};

/**
 * Convert due date to ISO string
 *
 * @param {number} dueDate The due date
 * @returns {string} The ISO string
 */
export let convertToIsoString = function( dueDate ) {
    if ( dueDate === '' ) {
        return dueDate;
    }
    var dstartDate = new Date( dueDate );
    dstartDate.setHours( 23, 59, 59, 0 );
    var dCurrentDate = new Date();
    if( dCurrentDate > dstartDate ) {
        dueDate = '';
        return dueDate;
    }
    return dstartDate.toISOString();
};

/**
  * Populate the targets data that will store present object and selected object in specific section.
  *
  * @param {String} context key string that will be targetObjects or referencesObjects
  * @param {Array} selectedObjects Selected objects present in each section.
  * @returns {Object} Object that will contain context specific info
 */
export let populateTargetsData = ( sharedData ) => {
    var modelObjects = [];
    const newSharedData = { ...sharedData.value };
    if ( sharedData.value.addedSourceObjects ) {
        newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects ];
    }

    // Get the local selection uid
    var selectedObject = selectionService.getSelection().selected;
    var selectedUid;
    if ( selectedObject[0].props.awb0UnderlyingObject ) {
        selectedUid = selectedObject[0].props.awb0UnderlyingObject.dbValues[0];
    } else {
        selectedUid = selectedObject[0].uid;
    }

    modelObjects = _.cloneDeep( selectedObject );

    // Add the targets from add panel
    _.forEach( newSharedData.addedSourceObjects, function( srcObject ) {
        var targetObject = cdm.getObject( srcObject.uid );
        if( selectedUid !== srcObject.uid ) {
            modelObjects.push( targetObject );
        }
    } );

    return {
        modelObjects : modelObjects
    };
};

/**
  * set data to the createTaskData
  * @param {Object} data Data
  */
export let saveCreateTaskState = function( data ) {
    // store create task panel data to a variable.
    createTaskData = data;
};

export let getCreateTaskState = function() {
    return createTaskData;
};

export default exports = {
    doTaskPanelInit,
    getCreateTaskState,
    openTaskAttachmentPanel,
    backToCreateTaskActionData,
    updateSharedDataWithTargets,
    removeTargetAttachment,
    getTargetUids,
    getAttachmentTypes,
    getTaskObject,
    convertToIsoString,
    populateTargetsData,
    setTaskName,
    setCreateTaskState,
    saveCreateTaskState
};

