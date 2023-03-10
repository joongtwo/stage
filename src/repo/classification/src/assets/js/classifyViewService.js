// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the response of the getAttributes2 classification SOA to be compatible with the generic
 * property widgets.
 *
 * @module js/classifyViewService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import classifyNodeSvc from 'js/classifyNodeService';
import classifySvc from 'js/classifyService';
import eventBus from 'js/eventBus';
import Ics1ClassificationTabSvc from 'js/Ics1ClassificationTabService';

var exports = {};

/*
 *   Check if each attribute in array is a block, and if it is flags it as such
 *
 *   @param {Array} inputArray property group array
 */
export let populatePropertyGroupTree = function( inputArray ) {
    if( inputArray ) {
        _.forEach( inputArray, function( attribute ) {
            if( attribute.type === 'Block' ) {
                //Check if attribute, and the attribute's children, has block children
                classifySvc.hasBlockChildren( attribute );
            }
        } );
    }
};

/**
 * Method to invoke loading of class attributes on cell selection change
 *
 * @param {ViewModelObject} data - The viewModelData
 * @param {Object} classifyState classify state
 * @param {Object} responseState response state
 * @param {Integer} panelMode panelMode
 */
export let processCellSelection = function( data, classifyState, responseState ) {
    classifySvc.setViewMode( data );

    data.attr_anno = null;
    data.imageURLs = null;
    data.viewerData = null;
    if ( data.propFilter ) {
        data.propFilter.dbValue = '';
    }
    if ( data.propGroupFilter ) {
        data.propGroupFilter.dbValue = '';
    }
    data.editProp = false;
    data.editPropInProgress = false;
    data.nodeAttr = null;

    //reset classify state
    let tmpState = { ...classifyState.value };
    tmpState = Ics1ClassificationTabSvc.resetClassifyState( tmpState );
    classifyState.update( tmpState );

    //get the classification cells
    var icoCells = data.icoCells;

    //find which cell is currently selected, and set selectedCell to it

    _.forEach( icoCells, function( icoCell ) {
        if( icoCell.selected ) {
            data.selectedCell = icoCell;
        }
    } );

    if ( icoCells && icoCells.length === 0 ) {
        data.selectedCell = null;
        data.selectedClass = null;
    }

    //If the currently selected cell is truely selected, continue
    if( data.selectedCell && data.selectedCell.selected ) {
        data.ico = {
            uid: data.selectedCell.uid,
            classID: data.selectedCell.cellInternalHeader1
        };

        data.selectedClass = {
            id: data.selectedCell.cellInternalHeader1,
            className: data.selectedCell.cellHeader1,
            uid: data.selectedCell.uid,
            hasUnits: false,
            classUid: classifySvc.classUidObjectForImageViewer( data.classesProperties )
        };

        data.hasBlocks = false;

        if( data.icoCells === null && data.cancelEditAction !== true ) {
            classifyNodeSvc.formatDataAndResponse( appCtxSvc.getCtx( 'ICO_response' ), data, classifyState, responseState );
        } else if( data.icoCells && data.icoCells.length > 0 && data.icoCells[ 0 ].uid === data.selectedCell.uid && data.cancelEditAction !== true ) {
            classifyNodeSvc.formatDataAndResponse( appCtxSvc.getCtx( 'ICO_response' ), data, classifyState, responseState );
        } else {
            classifyNodeSvc.getAttributes( data, classifyState, responseState );
        }
    } else {
        data.imageURLs = null;
        data.viewerData = null;
        data.clsImgAvailable = false;
        data.selectedCell = null;
        data.attr_anno = null;
        data.selectedClass = null;
        //set has blocks flag to false, used for Prop Group Tree
        data.hasBlocks = false;
        data.isFiltered = false;
        classifyNodeSvc.updateClassifyStateAttrs( classifyState, data );
    }
    if( data.cancelEditAction === true ) {
        data.cancelEditAction = false;
    }
};


/**
 * Loads the hierarchy when the create panel is revealed
 *
 * @param {Object} data  the declarative viewmodel
 * @param {Object} panelMode  panelmode
 */
export let revealCreate = function( data, panelMode ) {
    data.panelMode = panelMode;
    data.ico = null;
    data.attr_anno = null;
    data.imageURLs = null;
    data.viewerData = null;
    data.clsImgAvailable = false;

    //TODO: Handle ico selection in View
    if( data.standaloneObjectExists && !data.createForStandalone ) {
        data.hierarchyVisible = true;
        data.hierarchyExpanded = true;
    }
};

export let initializeSelectedUid = function( selectedNode, selectedUid, sectionName ) {
    let prevSelectedUid = selectedUid;
    if ( selectedNode && selectedNode.uid !== prevSelectedUid ) {
        let context = {
            caption: sectionName,
            viewName: sectionName,
            isCollapsed: true
        };
        eventBus.publish( 'awCommandPanelSection.collapse', context );
        return selectedNode.uid;
    }
    return selectedUid;
};

export let collapseClassesSection = function( viewName, isCollapsed, sectionName, currentClassCollapsed, classifyState ) {
    if( viewName === sectionName ) {
        // reset commands visibility status once new storage class is selected
        if( isCollapsed === true && classifyState.showProperties === false ) {
            const tmpState = { ...classifyState.value };
            tmpState.showProperties = true;
            tmpState.showImages = false;
            tmpState.showPropTree = false;
            classifyState.update( tmpState );
        }
        return isCollapsed;
    }
    return currentClassCollapsed;
};

export default exports = {
    collapseClassesSection,
    initializeSelectedUid,
    populatePropertyGroupTree,
    processCellSelection,
    revealCreate
};
