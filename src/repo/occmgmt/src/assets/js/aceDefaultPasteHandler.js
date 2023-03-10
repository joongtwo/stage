// Copyright (c) 2022 Siemens

/**
 * @module js/aceDefaultPasteHandler
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import addElementService from 'js/addElementService';
import occmgmtUtils from 'js/occmgmtUtils';
import contextStateMgmtService from 'js/contextStateMgmtService';
import pasteService from 'js/pasteService';
import tcDefaultPasteHandler from 'js/tcDefaultPasteHandler';
import adapterSvc from 'js/adapterService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import occmgmtStructureEditService from 'js/occmgmtStructureEditService';

var exports = {};

/**
 * set the variablity for Add sibling Panel
 * @param{ModelObject} targetObject Parent to which the object is to be pasted
 * @param{Array} Source objects array that need to be moved or pasted
 */
var updateCtxForAddUsingElementDrop = function( targetObject, sourceObjects, addObjectIntent ) {
    var addElementInput = {};

    addElementInput.parentElement = targetObject;
    if( addObjectIntent ) {
        if( addObjectIntent === 'MoveIntent' ) {
            addElementInput.addObjectIntent = 'MoveIntent';
        } else if( addObjectIntent === 'paste' ) {
            addElementInput.addObjectIntent = '';
        }
    } else {
        addElementInput.addObjectIntent = 'DragAndDropIntent';
        // Check if user is doing drag and drop then we need to get the parent Uids from input source
        // objects and we are storing the parent UID in context where these lines that are being moved
        // need to be removed so that in case if parent needs to be refesh for these lines it can happen.
        if( sourceObjects && !_.isEmpty( sourceObjects ) ) {
            var moveParentElementUids = [];
            _.forEach( sourceObjects, function( sourceObj ) {
                var parentUid = occmgmtUtils.getParentUid( sourceObj );
                if( parentUid ) {
                    moveParentElementUids.push( parentUid );
                }
            } );
            // Get the unique parent element uids that will be moved and set it to context
            moveParentElementUids = _.uniq( moveParentElementUids );
            addElementInput.moveParentElementUids = moveParentElementUids;
        }
    }

    /*
     * Here we are activating target view before proceeding for DnD operation.
     * 1. This will activate correct view in case of different configuration.
     * 2. This might activate wrong view When both view have target object avaialbe in there VMC.
     *    2.1 There is no harm with this as post processing will happen in jitter free way for both views.
     */
    var viewKeys = appCtxService.ctx.splitView ? appCtxService.ctx.splitView.viewKeys : [];
    for( var i = 0; i < viewKeys.length; i++ ) {
        var vmoID = appCtxService.ctx[ viewKeys[ i ] ].vmc.findViewModelObjectById( targetObject.uid );
        if( vmoID !== -1 ) {
            contextStateMgmtService.updateActiveContext( viewKeys[ i ] );
            break;
        }
    }

    var context;
    appCtxService.updatePartialCtx( 'aceActiveContext', appCtxService.ctx.aceActiveContext ? appCtxService.ctx.aceActiveContext :
        context = {} );
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );

    addElementService.processAddElementInput();
};

var createAddObjectInput = function( sourceObjects, targetObject ) {
    var soaInput = {};
    soaInput.input = {};
    soaInput.input.objectsToBeAdded = addElementService.getElementsToAdd( '', '', sourceObjects );
    soaInput.input.parentElement = targetObject;
    soaInput.input.siblingElement = appCtxService.ctx.aceActiveContext.context.addElement.siblingElement;
    soaInput.input.inputCtxt = {
        productContext: appCtxService.ctx.aceActiveContext.context.productContextInfo
    };
    soaInput.input.addObjectIntent = appCtxService.ctx.aceActiveContext.context.addElement.addObjectIntent;
    if( soaInput.input.addObjectIntent === 'DragAndDropIntent' ) {
        // In a multi-product scenario like a SWC/Workset, when drag and drop happens then, we need to make sure that we send PCI for target, rather then active PCI
        // This is because it is possible that the whole source product is moved into target. When this happens then the PCI for source is invalid and should not be used.
        let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
        let targetPCI = occmgmtUtils.getProductContextForProvidedObject( targetObject, currentContext );
        if( targetPCI ) {
            soaInput.input.inputCtxt.productContext = cdmService.getObject( targetPCI );
        }
    }
    soaInput.input.sortCriteria = {
        propertyName: appCtxService.ctx.aceActiveContext.context.sortCriteria ? appCtxService.ctx.aceActiveContext.context.sortCriteria[ 0 ].fieldName : undefined,
        sortingOrder: appCtxService.ctx.aceActiveContext.context.sortCriteria ? appCtxService.ctx.aceActiveContext.context.sortCriteria[ 0 ].sortDirection : undefined
    };
    soaInput.input.fetchPagedOccurrences = true;
    soaInput.input.requestPref = addElementService.getRequestPrefValue( appCtxService.ctx.aceActiveContext.context );
    soaInput.input.numberOfElements = 1;

    return soaInput;
};

/**
  * @param {Object} parentElemt parent VMO
  */
let _updateSecondaryWorkAreaForGivenParent = function( elementInfo ) {
    if ( elementInfo.parentElement.props.awb0NumberOfChildren.dbValues[0] === '1' || elementInfo.newElements.length > 1 ) {
        var eventData = {};
        eventData.refreshLocationFlag = true;
        eventData.relations = '';
        eventData.relatedModified = [];
        eventData.relatedModified[0] = elementInfo.parentElement;
        eventBus.publish( 'cdm.relatedModified', eventData );
    }
};

export let addElement = function( sourceObjects, targetObject ) {
    var soaInput = createAddObjectInput( sourceObjects, targetObject );
    let deferred = AwPromiseService.instance.defer();
    var inputData = {};
    var totalObjectsAdded;
    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2019-06-OccurrenceManagement', 'addObject2', soaInput ).then( function( response ) {
        inputData.addElementResponse = response;
        totalObjectsAdded = addElementService.getTotalNumberOfChildrenAdded( response );
        if( totalObjectsAdded > 0 ) {
            _updateSecondaryWorkAreaForGivenParent( response.newElementInfos[0] );
        }
        if( response.ServiceData.partialErrors && totalObjectsAdded > 0 || !response.ServiceData.partialErrors && totalObjectsAdded > 0 ) {
            _postProcessAddObject( inputData );
        }

        let msgContext = {
            totalObjectsAdded: totalObjectsAdded,
            selectedObjectString: _.get( response, 'selectedNewElementInfo.newElements[0].props.object_string.dbValues[0]' ),
            parentObjectString: _.get( targetObject, 'props.object_string.dbValues[0]' )
        };

        singleElementAddSuccessful( msgContext, [ '{{selectedObjectString}}', '{{parentObjectString}}' ] );
        multipleElementAddSuccessful( msgContext, [ '{{totalObjectsAdded}}', '{{parentObjectString}}' ] );

        deferred.resolve( response );
    }, function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

var _postProcessAddObject = function( inputData ) {
    var eventData = {
        objectsToSelect: addElementService.getNewlyAddedChildElements( inputData ),
        addElementResponse: inputData.addElementResponse,
        addElementInput: appCtxService.ctx.aceActiveContext.context.addElement,
        viewToReact: appCtxService.ctx.aceActiveContext.key
    };
    eventBus.publish( 'addElement.elementsAdded', eventData );
    if( appCtxService.ctx.aceActiveContext.context.addElementInput.addObjectIntent === 'DragAndDropIntent' ) {
        eventBus.publish( 'ace.elementsMoved' );
    }
};

var addElementToBookmark = function( sourceObjects, targetObject, context ) {
    var inputData = {};
    inputData.targetObjectToAdd = targetObject;
    var soaInput = addElementService.getAddToBookMarkInput( inputData, '', sourceObjects );
    let deferred = AwPromiseService.instance.defer();

    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2016-03-OccurrenceManagement', 'addToBookmark2', { input: soaInput } ).then( function( response ) {
        inputData.addToBookMarkResponse = response;
        if( response.ServiceData.partialErrors && inputData.addToBookMarkResponse.addedProductsInfo.length >= 1 ||
            !response.ServiceData.partialErrors && inputData.addToBookMarkResponse.addedProductsInfo.length >= 1 ) {
            _postProcessAddToBookmark( inputData, context );
        }

        let msgContext = {
            totalObjectsAdded: response.addedProductsInfo.length,
            selectedObjectString: _.get( response, 'addedProductsInfo[0].rootElement.props.object_string.dbValues[0]' ),
            parentObjectString: _.get( inputData, 'targetObjectToAdd.props.object_string.dbValues[0]' )
        };

        singleElementAddSuccessful( msgContext, [ '{{selectedObjectString}}', '{{parentObjectString}}' ] );
        multipleElementAddSuccessful( msgContext, [ '{{totalObjectsAdded}}', '{{parentObjectString}}' ] );

        deferred.resolve( response );
    }, function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

let singleElementAddSuccessful = function( msgContext, params ) {
    if( msgContext.totalObjectsAdded === 1 ) {
        let meta = {
            path: 'OccurrenceManagementMessages',
            key: 'elementAddSuccessful',
            params: params,
            context: msgContext
        };
        showInfo( meta );
    }
};

let multipleElementAddSuccessful = function( msgContext, params ) {
    if( msgContext.totalObjectsAdded > 1 ) {
        let meta = {
            path: 'OccurrenceManagementMessages',
            key: 'multipleElementAddSuccessful',
            params: params,
            context: msgContext
        };
        showInfo( meta );
    }
};

let showInfo = function( meta ) {
    localeService.getLocalizedText( meta.path, meta.key ).then( function( localizedMessage ) {
        let message = messagingService.applyMessageParams( localizedMessage, meta.params, meta.context );
        messagingService.showInfo( message );
    } );
};

var _postProcessAddToBookmark = function( inputData, context ) {
    var newlyAddedProduct = addElementService.getNewlyAddedSwcProductInfo( inputData );
    var objectsToSelect = addElementService.getNewlyAddedSwcChildElements( inputData );
    occmgmtStructureEditService.loadAndSelectProvidedObjectInTree( context.occContext, objectsToSelect, newlyAddedProduct.productCtxInfo, undefined, undefined, true/*updateVmosNContextOnPwaReset*/ );
};

export let aceDefaultPasteHandler = function( targetObject, sourceObjects, context ) {
    var addObjectIntent = undefined;
    if( !context.isDragDropIntent ) {
        addObjectIntent = appCtxService.ctx.aceActiveContext.context.addObjectIntent;
    }
    if( appCtxService.ctx[ appCtxService.ctx.aceActiveContext.key ].isMarkupEnabled && !addObjectIntent ) {
        return;
    }
    if( context.isCommandSubPanel ) {
        // If paste target is command sub panel then do nothing
        return;
    }
    updateCtxForAddUsingElementDrop( targetObject, sourceObjects, addObjectIntent );
    return addElement( sourceObjects, targetObject );
};

export let aceDefaultPasteHandlerForSWC = function( targetObject, sourceObjects, context ) {
    var addObjectIntent = appCtxService.ctx.aceActiveContext.context.addObjectIntent;
    updateCtxForAddUsingElementDrop( targetObject, sourceObjects, addObjectIntent );
    return addElementToBookmark( sourceObjects, targetObject, context );
};

export let acePasteObjectsFromClipboard = function( commandContext ) {
    if( appCtxService.ctx.cutIntent && appCtxService.ctx.cutIntent === true ) {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'MoveIntent';
    } else {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'paste';
    }
    pasteService.execute( appCtxService.ctx.selected, appCtxService.ctx.awClipBoardProvider, '', commandContext );
};

export let attachmentOverridePasteHandler = function( targetObject, sourceObjects, relationType, occContext ) {
    let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
    let _primaryContextUid = currentContext.currentState.incontext_uid;
    if( !_primaryContextUid ) {
        return tcDefaultPasteHandler.tcDefaultPasteHandler( targetObject, sourceObjects, relationType );
    }
    //use adapter service to find backing object in case targetobject is RBO
    var objectsToBeAdapted = [];
    objectsToBeAdapted.push( sourceObjects );
    return adapterSvc.getAdaptedObjects( objectsToBeAdapted ).then( function( adaptedObjs ) {
        if( adaptedObjs && adaptedObjs.length > 0 ) {
            var sourceObjs = adaptedObjs[ 0 ];
            var _targetObjUid = currentContext.selectedModelObjects[ 0 ].uid;
            var attachObjectInput = null;
            _.forEach( sourceObjs, function( sourceObj ) {
                if( sourceObj !== null ) {
                    attachObjectInput = [ {
                        clientId: '',
                        relationType: relationType,
                        primary: {
                            type: 'Awb0Element',
                            uid: _targetObjUid
                        },
                        primaryContext: {
                            type: 'Awb0Element',
                            uid: _primaryContextUid
                        },
                        secondary: {
                            type: sourceObj.type,
                            uid: sourceObj.uid
                        }
                    } ];
                }
            } );
            return soaSvc.post( 'Internal-ActiveWorkspaceBom-2015-03-OccurrenceManagement', 'attachObjects', {
                input: attachObjectInput
            } ).then(
                function( response ) {
                    return response;
                } );
        }
        return AwPromiseService.instance.reject( 'Invalid response received' );
    } );
};

/**
 * Add element services
 */

export default exports = {
    addElement,
    aceDefaultPasteHandler,
    aceDefaultPasteHandlerForSWC,
    acePasteObjectsFromClipboard,
    attachmentOverridePasteHandler
};
