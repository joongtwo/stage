// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the response of the getAttributes2 classification SOA to be compatible with the generic
 * property widgets.
 *
 * @module js/Ics1ClassificationStandAloneService
 */
import _ from 'lodash';
import classifyDefinesService from './classifyDefinesService';
import classifyNodeSvc from 'js/classifyNodeService';
import classifySvc from 'js/classifyService';
import Ics1ClassificationTabSvc from 'js/Ics1ClassificationTabService';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Fires the event to navigate to the 'Create' classification sub-panel for standalone case
 * @param {Object} data the declarative viewmodel data
 * @param {Object} classifyState clasifyState
 */
export let setCreateModeForStandalone = function( data, classifyState ) {
    data.isNavigating = false;
    data.panelMode = 0;
    data.createForStandalone = true;
    classifyState.standaloneExists = false;
    classifyState.standaloneIco = null;
};

/**
 * Method to setup required variables,and to display prompt, for standalone Classification
 * @param {ViewModelObject} data - The viewModelData
 * @param {Object} classifyState - Classify state
 * @param {Object} responseState - Response state
 * @returns {Object} data - data viewmodel
 */
export let setupStandaloneDataAndPrompt = function( data, classifyState, responseState ) {
    data.standaloneIco = classifyState.value.standaloneIco;
    data.clsClassDescriptors = classifyState.value.clsClassDescriptors;
    var classId = classifySvc.getPropertyValue( data.standaloneIco.properties, classifySvc.UNCT_CLASS_ID );

    //response.clsDefMap[classId].properties, UNCT_CLASS_NAME
    // The vars required in editMode
    data.selectedCell = {
        icoUid: data.standaloneIco.clsObject.uid,
        cellInternalHeader1: classId,
        cellHeader: classifySvc.getPropertyValue(
            data.clsClassDescriptors[ classId ].properties, classifySvc.UNCT_CLASS_NAME )
    };

    // The vars required in editMode method to distinguish between
    // 'regular' edit and 'standalone' edit
    data.clsObjTag = data.standaloneIco.clsObject;
    data.standaloneObjectExists = true;
    data.icoCells = null;
    data.isFiltered = false;
    data.ico = {
        uid: data.selectedCell.icoUid,
        classID: data.selectedCell.cellInternalHeader1
    };
    data.selectedClass = {
        id: data.selectedCell.cellInternalHeader1,
        className: data.selectedCell.cellHeader
    };
    var newState = Ics1ClassificationTabSvc.setCreateMode( classifyState.value  );
    newState.panelMode = 1;
    classifyState.update( newState );
    classifyNodeSvc.getAttributes( data, classifyState, responseState );
    var context = {
        scope: {
            data: data
        }
    };
    eventBus.publish( 'classifyPanel.promptToHandleStandalone', context );
    return data;
};

/**
 * Following method checks if response contains standalone objects
 * @param {Object} data - Declarative view model
 * @param {Object} classifyState - Classify state
 * @param {Object} subPanelContext - subPanelContext the context of the current panel. Passed in from Props in the view model.
 * @returns {Object} tmpState - New classify state
 */
export let checkStandAlone = function( data, classifyState, subPanelContext ) {
    if( data && data.response && data.response.clsObjectDefs && !_.isEmpty( data.response ) ) {
        if( !_.isEmpty( data.response.clsObjectDefs[ 1 ][ 0 ] ) ) {
            if( !_.isEmpty( data.response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ] ) ) {
                if( !_.isEmpty( data.response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ].workspaceObject ) ) {
                    if( data.response.clsObjectDefs[ 1 ][ 0 ] && data.response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ] && data.response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ].workspaceObject ) {
                        if( data.response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ].workspaceObject.uid === 'AAAAAAAAAAAAAA' ) {
                            const tmpState = { ...classifyState.value };
                            const selectedObjectTypePrefix = subPanelContext.selected.type.slice( 0, 4 );
                            tmpState.standaloneIco = data.response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ];
                            tmpState.clsClassDescriptors = data.response.clsClassDescriptors;
                            tmpState.classParents = data.response.classParents;
                            tmpState.standaloneExists = selectedObjectTypePrefix !== classifyDefinesService.CLASS_OBJ_PREFIX_SML0 &&
                                                        selectedObjectTypePrefix !== classifyDefinesService.CLASS_OBJ_PREFIX_CST0;
                            tmpState.cancelStandAlone = true;
                            classifyState.update( tmpState );
                            return tmpState;
                        }
                    }
                }
            }
        }
    }
};

/**
 * sets configuration standalone
 * @param {*} selectedNodeRet selected treeNode
 * @param {*} classifyState classify state
 * @param {*} classifyStateUpdater classify state updater
 */
export let setStandalone = function( selectedNodeRet, classifyState, classifyStateUpdater  ) {
    const updateAtomicData = classifyStateUpdater.classifyState;
    let newState = { ...classifyState.value };
    newState = {
        attrs: [],
        selectedNode: selectedNodeRet,
        pasteClicked: false,
        pasteInProgress:false,
        standAlone: true
    };
    updateAtomicData( { ...classifyState, ...newState } );
};

/**
 * Initializes Tab for standalone
 * @param {*} classifyState classify state
 * @param {*} subPanelContext subpanel context
 * @param {*} classifyStateUpdater classify state
 */
export let initializeTabForStandalone = ( classifyState, subPanelContext,  classifyStateUpdater ) => {
    let newState = resetClassifyStateForStandAlone(  classifyState, subPanelContext  );
    if( classifyStateUpdater ) {
        const updateAtomicData = classifyStateUpdater.classifyState;
        updateAtomicData( { ...classifyState, ...newState } );
    } else if( classifyState.update ) { // not4cx - looks like classifyStateUpdater isn't true when it should be.
        classifyState.update( newState );
    }
};

/**
 * Resets classify state for standalone tab
 * @param {*} classifyState classify state
 * @param {*} subPanelContext subPanelContext
 */
export let resetClassifyStateForStandAlone = function(  classifyState, subPanelContext ) {
    let newState = { ...classifyState.value };
    newState.panelMode = 0;
    newState.attrs = [];
    newState.numOfAttrs = 0;
    newState.pasteClicked = false;
    newState.pasteInProgress = false;
    newState.isRecent = true;
    newState.editClassUID = classifyDefinesService.NULL_UID;
    newState.editClassCmd = {};
    newState.selectedClassNode = null;
    if( subPanelContext && subPanelContext.searchState ) {
        const tmpContext = { ...subPanelContext.searchState.value };
        if( tmpContext.standAlone === true ) {
            tmpContext.standAlone = false;
        }
        subPanelContext.searchState.update( tmpContext );
    }
    return newState;
};

/**
 * Resets classify state for standalone tab once create catalog command is clicked
 * @param {*} classifyState classify state
 * @param {*} subPanelContext classify state
 */
export let resetCreateModeForStandAlone = function( classifyState, subPanelContext ) {
    return resetClassifyStateForStandAlone( classifyState, subPanelContext );
};

/**
 * Following method process cancel operation if its in edit mode
 * @param {*} classifyState classify state
 * @param {*} subPanelContext classify state
 */
export let processCancelForStandAlone = function( classifyState, subPanelContext ) {
    classifyState.cancelEdits = true;
    return resetClassifyStateForStandAlone( classifyState, subPanelContext );
};


/**
 * Loads stand alone objects created in current session to the data provider
 *
 * @param {Object} dataProvider - data provider
 * @param {Object} context - search state
 */
export let loadMRUData = function( dataProvider, context ) {
    var objects = [];
    const tmpContext = { ...context.searchState.value };

    _.forEach( tmpContext.standAloneObjects, function( object ) {
        //Skip first 4 chars which indicate whether it is 'Sml0' (traditional) or 'Cst0'(eclass)
        var type = object.type.substring( 4, object.type.length );
        //ItemRevision check for GB
        if ( type === tmpContext.selectedNode.uid || object.classId === tmpContext.selectedNode.uid ||
            object.type === 'ItemRevision' ) {
            //moving the newly created object to the top
            //of the PWA
            objects.unshift( object );
        }
    } );

    tmpContext.mruObjects = objects;
    tmpContext.totalFound = objects.length;
    dataProvider.viewModelCollection.setViewModelObjects( objects );
    dataProvider.viewModelCollection.totalFound = objects.length;
    dataProvider.update( objects, objects.length );
    context.searchState.update( tmpContext );
};


export default exports = {
    checkStandAlone,
    initializeTabForStandalone,
    loadMRUData,
    processCancelForStandAlone,
    setCreateModeForStandalone,
    setStandalone,
    setupStandaloneDataAndPrompt,
    resetCreateModeForStandAlone,
    resetClassifyStateForStandAlone
};
