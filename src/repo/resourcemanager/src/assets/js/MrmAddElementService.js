// Copyright (c) 2022 Siemens

/**
 * @module js/MrmAddElementService
 */
import appCtxService from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import occurrenceManagementStateHandler from 'js/occurrenceManagementStateHandler';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import navigationUtils from 'js/navigationUtils';
import graphConstants from 'js/graphConstants';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';

var exports = {};

export let getDisplayMode = function() {
    var viewModeInfo = appCtxService.ctx.ViewModeContext;
    if( viewModeInfo.ViewModeContext === 'ListView' || viewModeInfo.ViewModeContext === 'ListSummaryView' ) {
        return 'List';
    }
    return 'Tree'; //Server expects 'Tree' in case of Table mode as well.
};

var saveCurrentSelectionUidToCheckSelectionChange = function( addElement ) {
    addElement.previousSelectionUid = appCtxService.ctx.selected.uid;
};

/**
 * Process input passed by consumer to the add element
 */
export let mrmProcessAddElementInput = function( isCompAddedAbove, isGCSAddWorkpieceSide ) {
    var activeContext = appCtxService.ctx.aceActiveContext.context || {};
    var addElementInput = activeContext.addElementInput || {};
    var addElement = {};
    var selectedNode = appCtxService.ctx.graph.graphModel.nodeMap[appCtxService.ctx.occmgmtContext.selectedModelObjects[0].uid];
    if ( !isCompAddedAbove ) {
        addElement.toComponent = viewModelObjectService.createViewModelObject( appCtxService.ctx.occmgmtContext.selectedModelObjects[0] );
    } else {
        var InEdges = selectedNode.getEdges( graphConstants.EdgeDirection.IN );
        var predecessorComp = InEdges[0].getSourceNode();
        addElement.toComponent = viewModelObjectService.createViewModelObject( predecessorComp.appData.nodeObject );
    }

    if ( isGCSAddWorkpieceSide ) {
        var numberOfResourceChild = 0;

        var outEdges = selectedNode.getEdges( graphConstants.EdgeDirection.OUT );
        var targetNode;
        var targetNodeProps;
        for ( var outEdge in outEdges ) {
            targetNode = outEdges[outEdge].getTargetNode();
            targetNodeProps = targetNode.appData.nodeObject.props;
            if ( targetNodeProps.awb0IsPacked && targetNodeProps.awb0IsPacked.dbValues[0] === '1' && targetNodeProps.awb0Quantity ) {
                numberOfResourceChild += parseInt( targetNodeProps.awb0Quantity.dbValues[ 0 ] );
            } else {
                numberOfResourceChild += 1;
            }
        }

        const occContext = appCtxService.getCtx( 'occmgmtContext' );
        var numberOfGCSSockets = occContext.numberOfGCSSockets;

        addElement.numberOfGCSSockets = numberOfGCSSockets;

        if( numberOfResourceChild >= numberOfGCSSockets ) {
            addElement.numberOfEmptySockets = 0;
        } else {
            addElement.numberOfEmptySockets = numberOfGCSSockets - numberOfResourceChild;
        }

        addElement.totalNumberOfComponentsLabel = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'totalNumberOfComps', numberOfGCSSockets );
        var errorMsg = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'numberOfComponentsZeroOrLessThanZero', addElement.numberOfEmptySockets );
        addElement.numberOfComponentsZeroOrLessThanZero = errorMsg;
        errorMsg = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'numberOfComponentsGreaterThanMaxError', numberOfGCSSockets );
        addElement.numberOfComponentsGreaterThanMaxError = errorMsg;
        errorMsg = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'numberOfComponentsGreaterThanDefaultMaxError', addElement.numberOfEmptySockets );
        errorMsg = errorMsg.replace( '{1}', numberOfResourceChild );
        errorMsg = errorMsg.replace( '{2}', numberOfGCSSockets );
        addElement.numberOfComponentsGreaterThanDefaultMaxError = errorMsg;
    }

    // set default values
    saveCurrentSelectionUidToCheckSelectionChange( addElement );
    addElement.parent = activeContext.topElement;
    addElement.parentToLoadAllowedTypes = activeContext.topElement;
    addElement.reqPref = exports.populateRequestPref();
    addElement.siblingElement = {};
    addElement.isCopyButtonEnabled = !occurrenceManagementStateHandler
        .isFeatureSupported( 'HideAddCopyButtonFeature_32' );
    addElement.operationType = 'Union';
    if( occmgmtUtils.isTreeView() ) {
        addElement.fetchPagedOccurrences = true;
    }

    // process custom input or extension values
    _.forEach( addElementInput, function( value, key ) {
        switch ( key ) {
            case 'parentElement':
                addElement.parent = value;
                break;
            case 'siblingElement':
                addElement.siblingElement = value;
                break;
            case 'parentToLoadAllowedTypes':
                addElement.parentToLoadAllowedTypes = value;
                break;
            case 'isCopyButtonEnabled':
                addElement.isCopyButtonEnabled = addElement.isCopyButtonEnabled && value;
                break;
            case 'addObjectIntent':
                addElement.addObjectIntent = value;
                break;
            case 'fetchPagedOccurrences':
                addElement.fetchPagedOccurrences = value;
                break;
            default:
                break;
        }
    } );

    // set the addElement
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement', addElement );

    eventBus.publish( 'addElement.getInfoForAddElementAction' );
};

/**
 * Returns reqPref
 */
export let populateRequestPref = function() {
    var stateSvc = navigationUtils.getState();
    var toParams = {};

    if( stateSvc.params.fd ) {
        toParams.fd = [ stateSvc.params.fd ];
    }

    toParams.restoreAutoSavedSession = [ 'true' ];

    toParams.useGlobalRevRule = [ 'false' ];
    if( stateSvc.params.useGlobalRevRule ) {
        toParams.useGlobalRevRule[ 0 ] = stateSvc.params.useGlobalRevRule;
    }

    if( stateSvc.params.usepinx ) {
        toParams.useProductIndex = [ stateSvc.params.usepinx ];
    }

    toParams.calculateFilters = [ 'false' ];
    if( stateSvc.params.isfilterModified ) {
        toParams.calculateFilters[ 0 ] = 'true';
    }

    if( stateSvc.params.customVariantRule ) {
        toParams.customVariantRule = [ stateSvc.params.customVariantRule ];
    }
    _.forEach( appCtxService.ctx.aceActiveContext.context.persistentRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            toParams[ name ] = [ value.toString() ];
        }
    } );
    return toParams;
};

/**
 * Returns elements to be added either newly created or elements selected from Palette and Search tabs
 */
export let getElementsToAdd = function( createdObject, sourceObjects ) {
    if( Array.isArray( createdObject ) ) {
        return createdObject;
    }

    // check if created a new object ? if yes, create an array, insert this newly created element in it and return
    if( createdObject ) {
        var objects = [];
        objects.push( createdObject );
        return objects;
    }
    // return all selected element from palette and search tabs
    return sourceObjects;
};

export let getNewlyAddedChildElements = function( data ) {
    // Collect the children for selected input parent.
    var newChildElements = [];

    if( data.addElementResponse.selectedNewElementInfo.newElements ) {
        for( var i = 0; i < data.addElementResponse.selectedNewElementInfo.newElements.length; ++i ) {
            newChildElements.push( data.addElementResponse.selectedNewElementInfo.newElements[ i ] );
        }
    }

    // Collect the children for other reused parent instances
    _.forEach( data.addElementResponse.newElementInfos, function( newElementInfo ) {
        // Get the parent VMO
        var vmc = appCtxService.ctx.aceActiveContext.context.vmc;
        if( vmc ) {
            var parentIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
                return vmo.uid === newElementInfo.parentElement.uid;
            } );
            var parentVMO = vmc.getViewModelObject( parentIdx );

            // If parent is expanded then only add the children
            if( parentVMO && parentVMO.isExpanded ) {
                _.forEach( newElementInfo.newElements, function( newElement ) {
                    newChildElements.push( newElement );
                } );
            }
        }
    } );

    return newChildElements;
};

export let getNewlyAddedChildElementsUID = function( data ) {
    // Collect the children for selected input parent.
    var newChildElementsUID = [];

    if( data.addElementResponse.selectedNewElementInfo.newElements ) {
        for( var i = 0; i < data.addElementResponse.selectedNewElementInfo.newElements.length; ++i ) {
            newChildElementsUID.push( data.addElementResponse.selectedNewElementInfo.newElements[ i ].uid );
        }
    }

    // Collect the children for other reused parent instances
    _.forEach( data.addElementResponse.newElementInfos, function( newElementInfo ) {
        // Get the parent VMO
        var vmc = appCtxService.ctx.aceActiveContext.context.vmc;
        if( vmc ) {
            var parentIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
                return vmo.uid === newElementInfo.parentElement.uid;
            } );
            var parentVMO = vmc.getViewModelObject( parentIdx );

            // If parent is expanded then only add the children
            if( parentVMO && parentVMO.isExpanded ) {
                _.forEach( newElementInfo.newElements, function( newElement ) {
                    newChildElementsUID.push( newElement.uid );
                } );
            }
        }
    } );

    return newChildElementsUID;
};

export let getTotalNumberOfChildrenAdded = function( data ) {
    var totalNewElementsAdded = 0;

    // First get the count of all the new children for input parent.
    if( data.selectedNewElementInfo.newElements ) {
        totalNewElementsAdded = data.selectedNewElementInfo.newElements.length;
    } else {
        // Get children count from other parent instances
        _.forEach( data.newElementInfos, function( newElementInfo ) {
            if( newElementInfo.newElements ) {
                totalNewElementsAdded += newElementInfo.newElements.length;
            }
        } );
    }
    return totalNewElementsAdded;
};

export let setStateAddElementInputParentElementToSelectedElement = function( subPanelContext, data ) {
    if ( subPanelContext && subPanelContext.occContext && data && data.addElementState ) {
        var newAddElementState = { ...data.addElementState };

        var selectedUid = subPanelContext && subPanelContext.occContext && subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length > 0
            ? subPanelContext.occContext.selectedModelObjects[0].uid : appCtxService.ctx.selected.uid;
        var selectedVMO = viewModelObjectService.createViewModelObject( selectedUid );
        newAddElementState.toComponent = selectedVMO;
        var parentVMO;
        //In "Resource" view mode we always add components to top component
        if ( selectedVMO.props.awb0Parent && selectedVMO.props.awb0Parent.dbValues[0] !== null ) {
            parentVMO = viewModelObjectService.createViewModelObject( selectedVMO.props.awb0Parent.dbValues[0] );
        } else {
            parentVMO = selectedVMO;
        }

        newAddElementState.parent = parentVMO;
        newAddElementState.parentElement = parentVMO;
        newAddElementState.parentToLoadAllowedTypes = parentVMO;

        newAddElementState.siblingElement = {};

        return { ...newAddElementState };
    }
};

export default exports = {
    getDisplayMode,
    mrmProcessAddElementInput,
    populateRequestPref,
    getElementsToAdd,
    getNewlyAddedChildElements,
    getNewlyAddedChildElementsUID,
    getTotalNumberOfChildrenAdded,
    setStateAddElementInputParentElementToSelectedElement
};
