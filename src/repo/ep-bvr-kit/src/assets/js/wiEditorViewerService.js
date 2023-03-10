// Copyright (c) 2021 Siemens

/**
 * Initialization service for WI Editor.
 *
 * @module js/wiEditorViewerService
 */
import $ from 'jquery';
import epContextService from 'js/epContextService';
import {
    constants as epBvrConstants
} from 'js/epBvrConstants';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import wiEditorService from 'js/wiEditor.service';
import appCtxService from 'js/appCtxService';
import { constants as wiCtxConstants } from 'js/wiCtxConstants';
import popupService from 'js/popupService';
import awPromiseService from 'js/awPromiseService';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import policySvc from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import leavePlaceService from 'js/leavePlace.service';
import mfeTableService from 'js/mfeTableService';
import vMOService from 'js/viewModelObjectService';
import epBvrObjectService from 'js/epBvrObjectService';
import epChangeIndicationSvc from 'js/epChangeIndicationService';
import dmSvc from 'soa/dataManagementService';
import mfeSyncUtils from 'js/mfeSyncUtils';


let ckEditorIdToObjUid = [];
let _popupRef = null;

let isClassicBOP = false;
const EDITOR_TEXTAREA_ID = 'Textarea';
const SAVE_WI_DATA_EVENT_TYPE = 'SaveWIData';
const SAVE_CREATE_EVENT_TYPE = 'create';
const REMOVED_FROM_RELATION_EVENT = 'removedFromRelation';
const ADDED_TO_RELATION_EVENT = 'addedToRelation';
let changeAlertPropertyPolicy = null;

const AUTOPREDICT_POPUP_CONTAINER_CLASS =  'aw-epInstructionsEditor-autoPredictPopupContainer';

function updateOccContextToVMO( dataProvider, occContext ) {
    dataProvider.getViewModelCollection().getLoadedViewModelObjects().forEach( vmo=>vmo.occContext = occContext );
}
/**
 * This method is used to initiate editor data
 * @param {object} isIndicationOn - get the indication toggle value
 * @returns {object} editorsToLoad
 */
function onInit( isIndicationOn ) {
    wiEditorService.registerEditorLeaveHandler();
    wiEditorService.loadRichTextEditor();
    ckEditorIdToObjUid = [];
    //get selected object from ctx
    if ( mfeTypeUtils.isOfType( appCtxService.getCtx( 'ep.scopeObject' ), epBvrConstants.MFG_BVR_PROCESS ) ) {
        isClassicBOP = true;
    }
    //getproperties needed for assembly structure
    const loadedProductViewModel = appCtxService.getCtx( 'ep.loadedProductObject' );
    if( loadedProductViewModel && loadedProductViewModel.uid ) {
        let partsUidsList = [];
        const assemblyStructure = cdm.getObject( loadedProductViewModel.uid );
        if( assemblyStructure && assemblyStructure.props && assemblyStructure.props.bl_all_child_lines !== undefined ) {
            assemblyStructure.props.bl_all_child_lines.dbValues.map( uid =>
                partsUidsList.push( uid )
            );
            dmSvc.getProperties( partsUidsList, [ epBvrConstants.BL_ITEM_ITEM_ID ] );
        }
    }

    const epPageContext = epContextService.getPageContext();
    const selectedObj = epPageContext.loadedObject;
    // on first time it arrives here before the page context is loaded.
    if( selectedObj ) {
        const processloadInputs = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.WI_EDITOR_DATA,
            selectedObj.uid );
        changeAlertPropertyPolicy = policySvc.register( {
            types: [ {
                name: epBvrConstants.IMAN_ITEM_BOP_LINE,
                properties: [ {
                    name: epBvrConstants.BL_REV_OBJECT_TYPE
                } ]
            } ]
        } );
        const policyId = registerLoadPolicy();

        return epLoadService.loadObject( processloadInputs, false ).then( function( output ) {
            if ( policyId ) {
                policySvc.unregister( policyId );
            }
            const epPageContext = epContextService.getPageContext();

            const topEditorData = output.relatedObjectsMap[epPageContext.loadedObject.uid];
            const wiObjectUIDs = topEditorData.additionalPropertiesMap2.WorkinstructionObjects;

            const editorsToLoad = {};

            editorsToLoad.editorsData = wiObjectUIDs.map( objUID => {
                if ( !ckEditorIdToObjUid[wiEditorService.getDivId( objUID ) + EDITOR_TEXTAREA_ID] ) {
                    return updateEditor( objUID, output.relatedObjectsMap[ objUID ], output.ServiceData.modelObjects[ objUID ], isIndicationOn );
                }
            } );

            return editorsToLoad;
        } );
    }
}


/**
 * This method is used to open Auto Predict Popups (Stx , partstools)
 *
 * @param {Object} eventData event data - view to load, popup offset
 */
function openAutoPredictPopup( eventData ) {
    const data = {
        options: {
            view: eventData.viewTobeLoaded,
            isModal: false,
            clickOutsideToClose: true,
            innerClassName: AUTOPREDICT_POPUP_CONTAINER_CLASS,
            placement: 'bottom-start',
            whenParentScrolls: 'close',
            disableUpdate: true
        }
    };
    const deferred = awPromiseService.instance.defer();
    popupService.show( data ).then( function( popupRef ) {
        _popupRef = popupRef;
        const autoPredictPopupContainerElement = $( '.' + AUTOPREDICT_POPUP_CONTAINER_CLASS );
        if( eventData.popupOffset && autoPredictPopupContainerElement ) {
            autoPredictPopupContainerElement.offset( {
                left: eventData.popupOffset.left,
                top: eventData.popupOffset.top
            } );
        }
        deferred.resolve( popupRef );
    } );
}


/**
 * This method is used to close the Search Standard TextPopup and PartsTools Popup
 */
export function closeAutoPredictListPopup() {
    if ( _popupRef !== null ) {
        popupService.hide( _popupRef );
        _popupRef = null;
    }
}

/**
 *  update Step Editor with WI Data
 *  @param {Array} objUID Array of UID
 *  @param {object} stepData stepData
 *  @param {object} stepObject stepObject
 *  @param {object} indicationOn indicationOn
 *  @return {object} vmo ViewModelObject
 */
function updateEditor( objUID, stepData, stepObject, indicationOn ) {
    const divID = wiEditorService.getDivId( objUID );
    const textareaID = divID + EDITOR_TEXTAREA_ID;
    ckEditorIdToObjUid[textareaID] = {
        data: {
            object: stepObject,
            editorInstacnce: textareaID
        }
    };
    appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_EDITOR_ID_TO_OBJ_UID, ckEditorIdToObjUid );

    const divTextArea = divID + EDITOR_TEXTAREA_ID;
    const vmo = mfeVMOLifeCycleSvc.createViewModelObjectFromUid( objUID );
    vmo.wiStepEditorDivId = divID,
    vmo.wiStepEditorTextareaId = divTextArea,
    vmo.wiStepData = stepData,
    vmo.isClassicBop = isClassicBOP,
    vmo.wiStepObject = stepObject,
    vmo.parentObject = stepObject.props.bl_parent && cdm.getObject( stepObject.props.bl_parent.dbValues[ 0 ] ),
    vmo.isResequenceNeeded = true;
    vmo.hideCreateAndAddMoreButton = true;
    vmo.reloadType = {
        epCreate: 'GetWIData',
        epClone: 'GetWIData'
    };
    epChangeIndicationSvc.updateIndicationMatchPropertyOnVmo( vmo, indicationOn, 'ChangeIndication' );
    return vmo;
}

/**
 * attachScrollPanelListener
 */
export function attachScrollPanelListener() {
    /**
     * Framework behviour on cell command popup is to follow the parent element when it is scrolled.
     * Since we don't want that, this is a work-around where we hide ALL opened popups when Editor list is scrolled.
     *
     * Note: Not using anonymous function as the handler will NOT be identical.
     * Refer - https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#multiple_identical_event_listeners
     */
    function scrollListener() {
        popupService.hide();
    }

    const wiEditorContainerElement = document.getElementsByClassName( 'aw-epInstructionsEditor-wiEditorContainer' )[ 0 ];
    wiEditorContainerElement.addEventListener( 'scroll', scrollListener );
}

/**
 * Destroy
 */
export function destroy() {
    //check for clear CK editor
    if ( !wiEditorService.editorHasChanges() ) {
        wiEditorService.clearEditorData();
    }

    if( changeAlertPropertyPolicy ) {
        policySvc.unregister( changeAlertPropertyPolicy );
    }

    // de-register leave placeholder

    leavePlaceService.registerLeaveHandler( null );
}
/**
 * Handles refresh in the Editor panel
 * @param {Array} eventData -  Array of UID in a ordered sequence
 * @param {Object} dataProvider - the WIEditor data provider
 */
export function handleEditorRefresh( eventData, dataProvider ) {
    const viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.loadedVMObjects;
    if( eventData.wiEditorData && loadedVMObjects && eventData.wiEditorData.length > 0 && loadedVMObjects.length > 0 ) {
        loadedVMObjects.sort( ( obj1, obj2 ) => eventData.wiEditorData.indexOf( obj1.uid ) - eventData.wiEditorData.indexOf( obj2.uid ) );
    }
    dataProvider.update( loadedVMObjects, loadedVMObjects.length );
}

/**
 * Handles Save Events in the Editor panel
 *
 * @param {Object} eventData - the save events as json object
 */
export function handleSaveEvents( eventData, dataProvider ) {
    //Handle Save Events for Save WI Data
    if ( !eventData.saveEvents || eventData.saveEvents.length === 0 ) {
        return;
    }
    const saveWIDataEvent = getEventData( eventData, SAVE_WI_DATA_EVENT_TYPE );
    saveWIDataEvent && saveWIDataEvent.length > 0 && handleSaveWIDataEvent( saveWIDataEvent );

    //Handle remove step event
    const removeEvent = getEventData( eventData, REMOVED_FROM_RELATION_EVENT );
    const objectToRemove = removeEvent.map( object => object.eventObjectUid );
    removeEvent && removeEvent.length > 0 && handleDeleteEvents( objectToRemove, dataProvider );

    //Handle add new step event
    const saveCreateEvent = getEventData( eventData, SAVE_CREATE_EVENT_TYPE );
    saveCreateEvent.push( ...getEventData( eventData, ADDED_TO_RELATION_EVENT ) );
    saveCreateEvent && saveCreateEvent.length > 0 && handleSaveCreateEvent( eventData, saveCreateEvent, dataProvider );
}

/**
 * Handles Save Events in the Editor panel, for Save Work Instructions
 *  @param {Object} saveWIDataEvent - save Event Data
 */
function handleSaveWIDataEvent( saveWIDataEvent ) {
    saveWIDataEvent.forEach( saveEvent => {
        const bodyText = saveEvent.eventData[0];
        const textareaID = wiEditorService.getDivId( saveEvent.eventObjectUid ) + EDITOR_TEXTAREA_ID;
        let editorInstance = wiEditorService.getEditorInstance( textareaID );
        if ( editorInstance ) {
            editorInstance.setData( bodyText );
        }
    } );
    wiEditorService.resetDirtyEditors();
}
/**
 * This methods added VMOs to dataProvider.viewModelCollection.loadedVMObjects
 * This can be used only in case you flat tree, a tree without expand. As method doesn't creates treeNode.
 *
 * @param { Object } objUidToAddList - Array of objects UID we want to Add to data - provider
 * @param { Object } dataProvider - data provider which need to be updated
 */
export function handleSaveCreateEvent( eventData, saveCreateEvents, dataProvider ) {
    let createdObjs = [];
    const viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.loadedVMObjects;
    const wiDataEvents = eventData.saveEvents.filter( event => event.eventType === 'WIData' );
    saveCreateEvents.forEach( saveCreateEvent => {
        const createdObj = vMOService.createViewModelObject( saveCreateEvent.eventObjectUid );
        //get its WI data
        wiDataEvents.forEach( wiDataEvent => {
            if ( createdObj && createdObj.uid && createdObj.uid === wiDataEvent.eventObjectUid ) {
                const body_text = wiDataEvent.eventData[0];
                const isDirty = wiDataEvent.eventData[1];
                const stepData = {
                    additionalPropertiesMap2: {
                        epw0body_text2: [ body_text ],
                        isDirty: isDirty
                    }
                };
                createdObjs.push( updateEditor( saveCreateEvent.eventObjectUid, stepData, createdObj ) );
            }
        } );
    } );
    if ( createdObjs.length > 0 ) {
        createdObjs.sort( ( obj1, obj2 ) => {
            const bl_sequence_no_obj1 = parseInt( obj1.props.bl_sequence_no.dbValues[ 0 ] );
            const bl_sequence_no_obj2 = parseInt( obj2.props.bl_sequence_no.dbValues[ 0 ] );
            return bl_sequence_no_obj1 - bl_sequence_no_obj2;
        } );
        const parentObj = epBvrObjectService.getParent( createdObjs[0] );
        const addAfterObject = getObjectToAddAfter( parentObj, createdObjs[0] );

        let refIndex = addAfterObject ? getRefIndexForNewlyPastedOperation( addAfterObject, loadedVMObjects, createdObjs[ 0 ] ) : loadedVMObjects.findIndex( ( obj ) => obj.uid === parentObj.uid );
        loadedVMObjects.splice( refIndex + 1, 0, ...createdObjs );

        dataProvider.viewModelCollection.setTotalObjectsFound( loadedVMObjects.length );
        dataProvider.noResults = loadedVMObjects.length === 0;

        mfeSyncUtils.setSelection( dataProvider, createdObjs[ 0 ] );
    }
}
/**
 * Handle delete events
 *
 * @param {Object} deleteEvent - the save events as json object
 * @param {Object} dataProvider - the WIEditor data provider
 */
function handleDeleteEvents( deleteEvents, dataProvider ) {
    let objToRemoveList = [];
    const viewModelCollection = dataProvider.getViewModelCollection();
    const loadedVMObjects = viewModelCollection.loadedVMObjects;
    //check whether relevant obj is deleted
    let refIndex = loadedVMObjects.findIndex( ( obj ) => {
        return deleteEvents[ 0 ] === obj.uid || deleteEvents[ 0 ].uid === obj.uid;
    } );
    if( refIndex === -1 ) {
        return;
    }

    let dirtyEditor = appCtxService.getCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR );
    deleteEvents.forEach( objToDelUid => {
        const editorId = wiEditorService.getDivId( objToDelUid ) + 'Textarea';
        objToRemoveList.push( objToDelUid );
        //remove obj from dirty editor
        dirtyEditor && dirtyEditor[editorId] && delete dirtyEditor[editorId];
    } );
    appCtxService.updatePartialCtx( wiCtxConstants.WI_EDITOR_DIRTY_EDITOR, dirtyEditor );
    objToRemoveList && objToRemoveList.length > 0 && mfeTableService.removeFromDataProvider( objToRemoveList, dataProvider );
}

/**
 * Find the op
 *
 * @param {Object} parent - the parent Object of the created Obj
 * @param {Object} createdObj - the newly Created Obj
 */
function getObjectToAddAfter( parent, createdObj ) {
    let children = [];
    if( parent.modelType.typeHierarchyArray.includes( epBvrConstants.MFG_PROCESS_STATION ) ) {
        children = epBvrObjectService.getSequencedChildren( parent, epBvrConstants.MFG_ALLOCATED_OPS );
    }else{
        children = epBvrObjectService.getSequencedChildren( parent, epBvrConstants.MFG_SUB_ELEMENTS );
    }

    let index = children.findIndex( object => object.uid === createdObj.uid );
    const addAfterObj = children[index - 1];

    return addAfterObj && mfeVMOLifeCycleSvc.createViewModelObjectFromUid( addAfterObj.uid );
}

/**
 * Find the refIndex
 * This function is needed to check the hierarchy for the
 * addAfter Process (if it has children we ensure that we traverse the hierarchy when pasting editors) ,
 * and based on hierarchy and get the correct refIndex to create editor at correct location.
 * @param {Object} addAfterObject - the object after which operation is to be pasted
 * @param {Object} loadedVMObjects - Loaded Editor Objects
 * @param {Object} createdObj - the newly Created Obj
 * @returns {int} refIndex
 */

function getRefIndexForNewlyPastedOperation( addAfterVMOObject, loadedVMObjects, createdObj ) {
    let parentObj = epBvrObjectService.getParent( createdObj );
    let refIndex = loadedVMObjects.findIndex( ( obj ) => obj.uid === addAfterVMOObject.uid );
    let addAfterObject = cdm.getObject( addAfterVMOObject.uid );
    if( loadedVMObjects[ refIndex + 1 ] && mfeTypeUtils.isOfType( addAfterObject, epBvrConstants.MFG_BVR_PROCESS ) ) {
        let loadedVMOObj = cdm.getObject( loadedVMObjects[ refIndex + 1 ].uid );
        while( parentObj ) {
            parentObj = epBvrObjectService.getParent( loadedVMOObj );
            if( parentObj === addAfterObject ) {
                refIndex += 1;
                if( loadedVMObjects[ refIndex + 1 ] ) {
                    loadedVMOObj = cdm.getObject( loadedVMObjects[ refIndex + 1 ].uid );
                } else {
                    return refIndex;
                }
            } else {
                loadedVMOObj = parentObj;
            }
        }
    }
    return refIndex;
}

/**
 * filter event data by type
 *
 * @param {Object} eventData - the save events as json object
 * @param {String} eventType - event Type
 */
function getEventData( eventData, eventType ) {
    return eventData.saveEvents.filter( event => event.eventType === eventType );
}

/**
 * Register the policy
 *
 * @return {Object}  policyId
 */
function registerLoadPolicy() {
    return policySvc.register( {
        types: [ {
            name: epBvrConstants.MFG_BVR_OPERATION,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            } ]
        },
        {
            name: epBvrConstants.MFG_BVR_PROCESS,
            properties: [ {
                name: epBvrConstants.MFG_SUB_ELEMENTS
            } ]
        }
        ]
    } );
}


export default {
    onInit,
    openAutoPredictPopup,
    closeAutoPredictListPopup,
    attachScrollPanelListener,
    destroy,
    handleSaveEvents,
    handleDeleteEvents,
    updateOccContextToVMO,
    handleEditorRefresh
};
