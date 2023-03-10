// Copyright (c) 2022 Siemens

/**
 * @module js/MrmDefaultPasteHandler
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import mrmAddElementService from 'js/MrmAddElementService';
import graphConstants from 'js/graphConstants';
import pasteService from 'js/pasteService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';

var exports = {};

/**
 * set the variablity for Add Panel
 * @param{ModelObject} targetObject Parent to which the object is to be pasted
 * @param{Array} Source objects array that need to be pasted
 * @param{ModelObjects} sourceObjects objects which is to be pasted
 */
var updateCtxForAddUsingElementDrop = function( targetObject, sourceObjects ) {
    var addElementInput = {};

    addElementInput.parentElement = targetObject;
    if ( appCtxService.ctx.aceActiveContext.context.addObjectIntent ) {
        if ( appCtxService.ctx.aceActiveContext.context.addObjectIntent === 'MoveIntent' ) {
            addElementInput.addObjectIntent = 'MoveIntent';

            var cutNode = appCtxService.ctx.graph.graphModel.nodeMap[sourceObjects[0].uid];
            var inEdgesOfCutNode = cutNode.getEdges( graphConstants.EdgeDirection.IN );
            var sourceNodeOfInEdgesOfCutNode = inEdgesOfCutNode[0].getSourceNode();
            var startNodeUIDOfCutNode = sourceNodeOfInEdgesOfCutNode.appData.nodeObject.uid;
            var topNodeUID = appCtxService.ctx.aceActiveContext.context.topElement.uid;

            if( topNodeUID === startNodeUIDOfCutNode ) {
                addElementInput.cutComponentFromRoot = true;
            } else {
                addElementInput.cutComponentFromRoot = false;
            }

            addElementInput.inEdgesOfCutNode = inEdgesOfCutNode;
            delete appCtxService.ctx.aceActiveContext.context.addObjectIntent;
        } else if( appCtxService.ctx.aceActiveContext.context.addObjectIntent === 'paste' ) {
            addElementInput.addObjectIntent = '';
            delete appCtxService.ctx.aceActiveContext.context.addObjectIntent;
        }
    }

    // set the addElementInput
    var context;
    appCtxService.updatePartialCtx( 'aceActiveContext', appCtxService.ctx.aceActiveContext ? appCtxService.ctx.aceActiveContext :
        context = {} );
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );

    mrmAddElementService.mrmProcessAddElementInput();
};

var createAddObjectInput = function( sourceObjects ) {
    var soaInput = {};
    soaInput.input = {};
    soaInput.input.objectsToBeAdded = mrmAddElementService.getElementsToAdd( '', sourceObjects );
    soaInput.input.parentElement = appCtxService.ctx.aceActiveContext.context.addElement.parent;
    soaInput.input.siblingElement = appCtxService.ctx.aceActiveContext.context.addElement.siblingElement;
    soaInput.input.inputCtxt = {
        productContext: appCtxService.ctx.aceActiveContext.context.productContextInfo
    };
    soaInput.input.sortCriteria = {
        propertyName: appCtxService.ctx.aceActiveContext.context.sortCriteria ? appCtxService.ctx.aceActiveContext.context.sortCriteria[0].fieldName : undefined,
        sortingOrder: appCtxService.ctx.aceActiveContext.context.sortCriteria ? appCtxService.ctx.aceActiveContext.context.sortCriteria[0].sortDirection : undefined
    };
    soaInput.input.addObjectIntent = appCtxService.ctx.aceActiveContext.context.addElement.addObjectIntent;
    soaInput.input.fetchPagedOccurrences = appCtxService.ctx.aceActiveContext.context.addElement.fetchPagedOccurrences;
    soaInput.input.requestPref = {
        displayMode: [ mrmAddElementService.getDisplayMode() ]
    };
    soaInput.input.numberOfElements = 1;

    return soaInput;
};

var createAddResourceElementsPostActionsInput = function( addObjectResponse ) {
    var soaInput = {};
    soaInput.successorComponents = addObjectResponse.selectedNewElementInfo.newElements;
    soaInput.predecessorComponent = appCtxService.ctx.selected;
    return soaInput;
};

var addElement = function( sourceObjects, targetObject ) {
    var soaInput = createAddObjectInput( sourceObjects );
    let deferred = AwPromiseService.instance.defer();
    var inputData = {};
    var totalObjectsAdded;
    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2019-06-OccurrenceManagement', 'addObject2', soaInput ).then( function( response ) {
        inputData.addElementResponse = response;
        totalObjectsAdded = mrmAddElementService.getTotalNumberOfChildrenAdded( response );
        if ( response.ServiceData.partialErrors && totalObjectsAdded > 0 || !response.ServiceData.partialErrors ) {
            _postProcessAddObject( inputData );
        }

        let msgContext = {
            totalObjectsAdded: totalObjectsAdded,
            selectedObjectString: _.get( response, 'selectedNewElementInfo.newElements[0].props.object_string.dbValues[0]' ),
            parentObjectString: _.get( appCtxService.ctx.aceActiveContext.context.addElement.toComponent, 'props.object_string.dbValues[0]' )
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
        objectsToSelect: mrmAddElementService.getNewlyAddedChildElements( inputData ),
        addElementResponse: inputData.addElementResponse,
        addElementInput: appCtxService.ctx.aceActiveContext.context.addElement,
        viewToReact: appCtxService.ctx.aceActiveContext.key
    };

    var soaInput = createAddResourceElementsPostActionsInput( inputData.addElementResponse );

    let deferred = AwPromiseService.instance.defer();

    soaSvc.postUnchecked( 'Internal-ResourceManager-2020-12-ResourceOccurrencesManagement', 'addResourceElementsPostActions', soaInput ).then( function( response ) {
        if ( !response.partialErrors ) {
            eventData = {
                viewToReset: appCtxService.ctx.aceActiveContext.key
            };

            eventBus.publish( 'acePwa.reset', eventData );
        }

        deferred.resolve( response );
    }, function( error ) {
        deferred.reject( error );
    } );

    return deferred.promise;
};

let singleElementAddSuccessful = function( msgContext, params ) {
    if ( msgContext.totalObjectsAdded === 1 ) {
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
    if ( msgContext.totalObjectsAdded > 1 ) {
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

var cutFromRootPasteResourceElementsPostAction = function( sourceObjects, targetObject ) {
    var soaInput = {};
    soaInput.successorComponents = mrmAddElementService.getElementsToAdd( '', sourceObjects );
    soaInput.predecessorComponent = appCtxService.ctx.selected;

    let deferred = AwPromiseService.instance.defer();

    soaSvc.postUnchecked( 'Internal-ResourceManager-2020-12-ResourceOccurrencesManagement', 'addResourceElementsPostActions', soaInput ).then( function( response ) {
        if ( !response.partialErrors ) {
            var eventData = {
                viewToReset: appCtxService.ctx.aceActiveContext.key
            };

            eventBus.publish( 'acePwa.reset', eventData );
        }

        deferred.resolve( response );
    }, function( error ) {
        deferred.reject( error );
    } );

    return deferred.promise;
};

var cutFromNonRootPasteResourceElementsPostAction = function( sourceObjects, targetObject ) {
    var soaInput = {};
    soaInput.successorComponents = mrmAddElementService.getElementsToAdd( '', sourceObjects );
    soaInput.predecessorComponent = appCtxService.ctx.aceActiveContext.context.topElement;

    let deferred = AwPromiseService.instance.defer();

    soaSvc.postUnchecked( 'Internal-ResourceManager-2020-12-ResourceOccurrencesManagement', 'addResourceElementsPostActions', soaInput ).then( function( response ) {
        if ( !response.partialErrors ) {
            var topElementUID = appCtxService.ctx.occmgmtContext.topElement.uid;
            if( topElementUID === appCtxService.ctx.selected.uid ) {
                var eventData = {
                    viewToReset: appCtxService.ctx.aceActiveContext.key
                };

                eventBus.publish( 'acePwa.reset', eventData );
            } else{
                cutFromRootPasteResourceElementsPostAction( sourceObjects, targetObject );
            }
        }

        deferred.resolve( response );
    }, function( error ) {
        deferred.reject( error );
    } );

    return deferred.promise;
};

export let mrmDefaultPasteHandler = function( targetObject, sourceObjects ) {
    if ( !appCtxService.ctx.aceActiveContext.context.addObjectIntent ) {
        return;
    }

    updateCtxForAddUsingElementDrop( targetObject, sourceObjects );
    if( appCtxService.ctx.aceActiveContext.context.addElementInput.addObjectIntent === 'MoveIntent' ) {
        if( appCtxService.ctx.aceActiveContext.context.addElementInput.cutComponentFromRoot ) {
            return cutFromRootPasteResourceElementsPostAction( sourceObjects, targetObject );
        }

        return cutFromNonRootPasteResourceElementsPostAction( sourceObjects, targetObject );
    }

    var underlyingObjects = [];
    for ( var i = 0; i < sourceObjects.length; i++ ) {
        //Get underlying object, in resource view mode we always paste underlying object without any occurrence information.
        if ( sourceObjects[i].props.awb0UnderlyingObject ) {
            var underlyingObject = cdm.getObject( sourceObjects[i].props.awb0UnderlyingObject.dbValues[0] );
            if ( underlyingObject !== null ) {
                underlyingObjects.push( underlyingObject );
            }
        }
    }

    if ( underlyingObjects.length > 0 ) {
        return addElement( underlyingObjects, targetObject );
    }

    //It means source objects are already underlying objects
    return addElement( sourceObjects, targetObject );
};

export let mrmPasteObjectsFromClipboard = function() {
    if ( appCtxService.ctx.cutIntent && appCtxService.ctx.cutIntent === true ) {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'MoveIntent';
    } else {
        appCtxService.ctx.aceActiveContext.context.addObjectIntent = 'paste';
    }

    pasteService.execute( appCtxService.ctx.aceActiveContext.context.topElement, appCtxService.ctx.awClipBoardProvider, '' );
};

export default exports = {
    mrmDefaultPasteHandler,
    mrmPasteObjectsFromClipboard
};
