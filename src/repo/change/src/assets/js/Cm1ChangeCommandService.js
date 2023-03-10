// Copyright (c) 2022 Siemens

/**
 * @module js/Cm1ChangeCommandService
 */
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import commandsMapService from 'js/commandsMapService';
import appCtxService from 'js/appCtxService';
import preferenceSvc from 'soa/preferenceService';
import dmSvc from 'soa/dataManagementService';
import cmUtils from 'js/changeMgmtUtils';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import soa_kernel_propertyPolicyService from 'soa/kernel/propertyPolicyService';

var exports = {};

export let openSetLineagePanel = function( commandId, location ) {
    var selection = selectionService.getSelection();
    var selected = selection.selected;
    if( selected && selected.length > 0 ) {
        var SolutionItems = 'SolutionItems';
        var itemsSelected = {
            items: selected
        };
        appCtxService.registerCtx( SolutionItems, itemsSelected );

        var changeObject = 'changeObject';
        var changeobj = {
            object: selection.parent
        };
        appCtxService.registerCtx( changeObject, changeobj );

        var otherSideType = 'otherSideType';
        var typeName = {
            type: 'Cm1LineageImpactedProvider.' + exports.getSelectionType( selected[ 0 ] )
        };
        appCtxService.registerCtx( otherSideType, typeName );

        commandPanelService.activateCommandPanel( commandId, location );
    }
};

export let openCreateChangePanel = function( commandId, location, params ) {
    //Unset the "CreateChangePanel" context so it doesn't interfere with previous values.
    appCtxService.unRegisterCtx( 'CreateChangePanel' );
    var isDeriveCommand = false;
    if( commandId === 'Cm1ShowDeriveChange' ) {
        isDeriveCommand = true;
    }

    var selection = null;
    if( commandId !== 'Cm1ShowCreateChange' ) {
        selection = selectionService.getSelection().selected;
    }
    var hasExtraAttachements = false;
    var extraAttachementWithRelations = {};
    var exactTypeToCreate = '';
    var clientId = '';
    var openNewIssueInEditMode = true;

    //Default type is "ChangeItem"
    var typeNameToCreate = 'ChangeItem';

    //Read input from appCreateChangePanel.
    // Extra parameters can be passed from different client like visualization  via appCreateChangePanel
    var currentCtx = appCtxService.getCtx( 'appCreateChangePanel' );
    if( currentCtx ) {
        var appicationSelectedObjects = currentCtx.appSelectedObjects;
        if( appicationSelectedObjects ) {
            selection = appicationSelectedObjects;
        }
        // Base type for Derive Use case
        if( currentCtx.exactTypeToCreate ) {
            exactTypeToCreate = currentCtx.exactTypeToCreate;
        }

        // Client Id
        if( currentCtx.clientId ) {
            clientId = currentCtx.clientId;
        }

        //Is Panel hybrid panel. OOTB Derive panel doesn't show attachement but it show Implements section.
        //For some use case like "Create Issue From Issue", we need to show attachement and Implements both.
        if( currentCtx.hasExtraAttachements ) {
            hasExtraAttachements = currentCtx.hasExtraAttachements;
        }

        // Extra objects which needs to be associated to new change object
        if( currentCtx.appExtraAttachementWithRelations ) {
            extraAttachementWithRelations = currentCtx.appExtraAttachementWithRelations;
        }
        if( currentCtx.openNewIssueInEditMode !== undefined ) {
            openNewIssueInEditMode = currentCtx.openNewIssueInEditMode;
        }
        if(currentCtx.typeNameToCreate){
            typeNameToCreate = currentCtx.typeNameToCreate;
        }
    }

    //If sub location has "defaultTypeForCreate" argument than always consider that type as base type for CreateChange Panel
    if( params && params.defaultTypeForCreate ) {
        typeNameToCreate = params.defaultTypeForCreate;
    }

    //If cmdArg is provided than it will override all other type setting. For example cmdArg is provided when user click on Problem Report tile.
    if( params && params.cmdArg &&  params.cmdArg.length > 0 ) {
        typeNameToCreate = params.cmdArg[0];
        if( params.cmdArg[0] === 'ProblemReport' ) {
            typeNameToCreate = 'GnProblemReport';
            params.cmdArg = []; //Clearing this argument so sub sequent create change doens't take this into consideration.
        }
    }

    var prefNames = [ 'AWC_DefaultCreateTypes' ];
    var prefPromise = preferenceSvc.getStringValues( prefNames );
    if( prefPromise ) {
        prefPromise
            .then( function( values ) {
                var types = [];

                if( values === null ) {
                    types.push( 'ItemRevision' );
                } else {
                    for( var i = 0; i < values.length; i++ ) {
                        types.push( values[ i ] );
                    }
                }

                types.push( 'Dataset' );
                var attachmentTypes = '';
                for( var j = 0; j < types.length; j++ ) {
                    attachmentTypes += types[ j ];
                    if( j !== types.length - 1 ) {
                        attachmentTypes += ',';
                    }
                }

                var objectsToLoadUid = [];
                if( selection ) {
                    selection = cmUtils.getAdaptedObjectsForSelectedObjects( selection );

                    for( var k = 0; k < selection.length; k++ ) {
                        if( selection[ k ] && selection[ k ].modelType ) {
                            var typeHier = selection[ k ].modelType.typeHierarchyArray;
                            objectsToLoadUid.push( selection[ k ].uid );

                            if( typeHier.indexOf( 'WorkspaceObject' ) <= -1 &&
                                typeHier.indexOf( 'BOMLine' ) <= -1 ) {
                                typeNameToCreate = 'GnProblemReport';
                            }
                        }
                    }
                }

                if( appCtxService.getCtx( 'aw_hosting_state.currentHostedComponentId' ) === 'com.siemens.splm.client.change.CreateChangeComponent' ) {
                    typeNameToCreate = 'ChangeNotice';
                }
                //In case of ACE runtime object, the underlying object might not be loaded yet. So load the underlying object first.
                var promiseLoadObject = dmSvc.loadObjects( objectsToLoadUid );
                promiseLoadObject.then( function() {
                    var CreateChangePanel = 'CreateChangePanel';
                    var createChangeObj;

                    if( selection && selection[ 0 ] !== undefined ) {
                        createChangeObj = {
                            baseType: typeNameToCreate,
                            typesForAttachement: attachmentTypes,
                            selectedObjects: selection,
                            isDerive: isDeriveCommand,
                            hasExtraAttachements:hasExtraAttachements,
                            exactTypeToCreate: exactTypeToCreate,
                            extraAttachementWithRelations:extraAttachementWithRelations,
                            clientId: clientId,
                            openNewIssueInEditMode:openNewIssueInEditMode

                        };
                    } else {
                        createChangeObj = {
                            baseType: typeNameToCreate,
                            typesForAttachement: attachmentTypes,
                            isDerive: isDeriveCommand,
                            hasExtraAttachements:hasExtraAttachements,
                            exactTypeToCreate: exactTypeToCreate,
                            extraAttachementWithRelations:extraAttachementWithRelations,
                            clientId: clientId,
                            openNewIssueInEditMode:openNewIssueInEditMode

                        };
                    }
                    appCtxService.registerCtx( CreateChangePanel, createChangeObj );

                    commandPanelService.activateCommandPanel( commandId, location, null, null, null, {
                        isPinUnpinEnabled: true
                    } );
                } );
            } );
    }
};

export let getSelectionType = function( object ) {
    var selectedObjectType = null;
    if( commandsMapService.isInstanceOf( 'Mdl0ConditionalElement', object.modelType ) ) {
        selectedObjectType = 'Mdl0ConditionalElement';
    }
    if( commandsMapService.isInstanceOf( 'Cfg0AbsConfiguratorWSO', object.modelType ) ) {
        selectedObjectType = 'Cfg0AbsConfiguratorWSO';
    }
    if( commandsMapService.isInstanceOf( 'Bom0ConfigurableBomElement', object.modelType ) ) {
        selectedObjectType = 'Bom0ConfigurableBomElement';
    }
    if( commandsMapService.isInstanceOf( 'ItemRevision', object.modelType ) ) {
        selectedObjectType = 'ItemRevision';
    }
    return selectedObjectType;
};
/**
* Clears Visualization related context, when CreateChange/CreateChangeInContext/DeriveChange.
* panel is unloaded when closed/object created.
*/
export let clearVisCtx = function() {
    var changeCtx = appCtxService.getCtx( 'CreateChangePanel' );
    if( changeCtx.exactTypeToCreate !== '' ) {
        //Unset the "CreateChangePanel" context so it doesn't interfere with previous values.
        appCtxService.unRegisterCtx( 'CreateChangePanel' );

        //Unset the "appCreateChangePanel" context so it doesn't interfere with previous values.
        appCtxService.unRegisterCtx( 'appCreateChangePanel' );
    }
};

export let openCreateIssuePanel = function( objCreateIssueInput, openNewIssueInEditMode ) {
    var deferred = AwPromiseService.instance.defer();
    //Unset the "appCreateChangePanel" context so it doesn't interfere with previous values.
    appCtxService.unRegisterCtx( 'appCreateChangePanel' );

    if( objCreateIssueInput ) {
        //Selected Issue object from which New Issue type needs to be created
        var selectedIssueUid = '';
        if( objCreateIssueInput.IssueToCopyFrom ) {
            selectedIssueUid = objCreateIssueInput.IssueToCopyFrom;
        }

        //Command ID
        var commandId = 'Cm1ShowCreateChangeInContext'; //'Cm1ShowCreateChangeInContext'.

        // If selected issue is passed, its Derive Change command
        if( selectedIssueUid && selectedIssueUid !== '' ) {
            commandId = 'Cm1ShowDeriveChange';
        }

        // Location to launch Panel
        var location = 'aw_toolsAndInfo';
        //Set default type in Parameter
        var params = {};
        params.defaultTypeForCreate = objCreateIssueInput.IssueTypeName;
        //Client ID
        var clientId = objCreateIssueInput.ClientId;

        var objUidsToLoad = [];
        objUidsToLoad.push( selectedIssueUid );

        //Attachement objects and Selected Issue object might not be loaded in client. Load them.
        var selectedAttachementUids = [];
        var extraAttachementWithRelations = {};
        var attachmentUidArray = [];
        if( objCreateIssueInput.RelationData ) {
            attachmentUidArray = objCreateIssueInput.RelationData;
        }

        for( var inx = 0; inx < attachmentUidArray.length; inx++ ) {
            var attachmentsObj = attachmentUidArray[ inx ].AttachmentObjects;
            for( var jnx = 0; jnx < attachmentsObj.length; jnx++ ) {
                objUidsToLoad.push( attachmentsObj[ jnx ] );
                selectedAttachementUids.push( attachmentsObj[ jnx ] );

                var attachWithRelation = {};
                extraAttachementWithRelations[ attachmentsObj[ jnx ] ] = attachmentUidArray[ inx ].RelationName;
            }
        }

        //Setting this to load "revision_list" property incase of IssueReport ( Item ) is passed.

        var policy = soa_kernel_propertyPolicyService.register( {
            types: [ {
                name: 'Item',
                properties: [ {
                    name: 'revision_list'
                } ]
            } ]
        } );


        var selectedIssueRevisionVMO = null;
        dmSvc.loadObjects( objUidsToLoad ).then( function( loadedObjs ) {
            //Unregister Policy
            soa_kernel_propertyPolicyService.unregister( policy );


            //Get IssueReportRevision, either from Item or from Revision.
            if( selectedIssueUid && selectedIssueUid !== '' ) {
                var selectedIssueVMO = cdm.getObject( selectedIssueUid );
                if( selectedIssueVMO.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                    selectedIssueRevisionVMO = selectedIssueVMO;
                }

                if( selectedIssueVMO.modelType.typeHierarchyArray.indexOf( 'Item' ) > -1 ) { // Should be Item
                    var allRevisionUid = selectedIssueVMO.props.revision_list.dbValues;
                    if( allRevisionUid && allRevisionUid.length > 0 ) {
                        selectedIssueRevisionVMO = cdm.getObject( allRevisionUid[ 0 ] );
                    }
                }

                //If IssueReportRevision is found
                if( selectedIssueRevisionVMO ) {
                    //Need to set input IssueReportRevision object as selected object because Derive infroamtion for Create change panel is retrieved from selected objects on appContext.
                    appCtxService.ctx.mselected = [];
                    appCtxService.ctx.mselected[ 0 ] = selectedIssueRevisionVMO;
                    appCtxService.ctx.selected = selectedIssueRevisionVMO;
                }
            }

            // Populate Extra attachements
            var selectedAttachement = [];
            if( selectedAttachementUids && selectedAttachementUids.length > 0 ) {
                for( var knx = 0; knx < selectedAttachementUids.length; knx++ ) {
                    var attachVMO = cdm.getObject( selectedAttachementUids[ knx ] );
                    if( attachVMO ) {
                        selectedAttachement.push( attachVMO );
                    }
                }
            }

            var hasExtraAttachements = false;
            if( selectedAttachement.length > 0 ) {
                hasExtraAttachements = true;
            }

            //Set all required data to appCreateChangePanel context. Create Change panle code will pasee it to main context.
            var createChangeData = {
                appSelectedObjects: selectedAttachement,
                appExtraAttachementWithRelations: extraAttachementWithRelations,
                hasExtraAttachements: hasExtraAttachements,
                exactTypeToCreate: params.defaultTypeForCreate,
                clientId: clientId,
                openNewIssueInEditMode:openNewIssueInEditMode
            };
            appCtxService.registerCtx( 'appCreateChangePanel', createChangeData );

            //Open Create Change Panel.
            exports.openCreateChangePanel( commandId, location, params );

            // When Create Change operation is successful or panel is closed, need to return response to caller
            var createChangeEvent = eventBus.subscribe( 'createChangePanelClosed', function( eventData ) {
                if ( createChangeEvent ) {
                    eventBus.unsubscribe( createChangeEvent ); // Unsubscribe the event
                    createChangeEvent = null;
                }
                var changeCtx = appCtxService.getCtx( 'CreateChangePanel' );

                var response = {};
                // for Create Change and Derive Change Success use-case
                if ( eventData && eventData.createChangeResponse !== undefined
                    && ( eventData.createChangeResponse.length > 0 || Object.keys( eventData.createChangeResponse ).length !== 0 ) ) {
                    response = processSuccessResponseforVis( eventData, response );
                } else { // panel is closed without create.
                    response.status = 'createChangeCompletedWithoutCreate';
                    var retData = {
                        clientId: changeCtx.clientId
                    };
                    response.output = [];
                    response.output.push( retData );
                }

                //Return response to caller
                deferred.resolve( response );
            } );
        } );
    }

    //Promise of response to caller
    return deferred.promise;
};
/**
 *
 * @param {*} eventData
 * @param {*} response
 *
 * Success Response will send clientId,status and objects
 * that include only created Issue and IssueRevision
 */
var processSuccessResponseforVis = function( eventData, response ) {
    var sendArray = [];
    response.output = [];
    var changeCtx = appCtxService.getCtx( 'CreateChangePanel' );
    // for Create Change use-case, where createRelateAndSubmitObjects SOA response is received
    if ( eventData.createChangeResponse.length > 0 ) {
        var outputArray = eventData.createChangeResponse[0].objects;

        for ( var ijx = 0; ijx < outputArray.length; ijx++ ) {
            if ( changeCtx.exactTypeToCreate === outputArray[ijx].type ) {
                sendArray[0] = outputArray[ijx];
            } else if ( changeCtx.exactTypeToCreate + 'Revision' === outputArray[ijx].type ) {
                sendArray[1] = outputArray[ijx];
            }
        }
    }
    //for Derive Change use-case where deriveChangeItems SOA response is received
    else if ( Object.keys( eventData.createChangeResponse ).length !== 0 ) {
        var creKeys = Object.keys( eventData.createChangeResponse );
        var outputMap = eventData.createChangeResponse;

        for ( var inx = 0; inx < Object.keys( eventData.createChangeResponse ).length; inx++ ) {
            var resObj = outputMap[creKeys[inx]];
            if ( changeCtx.exactTypeToCreate === resObj.type ) {
                sendArray[0] = resObj;
            } else if ( changeCtx.exactTypeToCreate + 'Revision' === resObj.type ) {
                sendArray[1] = resObj;
            }
        }
    }
    //Return response to caller
    var clientData = {
        clientId: changeCtx.clientId
    };

    response.output.push( clientData );
    response.output[0].objects = sendArray;
    response.status = 'createChangeCompletedSuccessfully';
    return response;
};

export default exports = {
    openSetLineagePanel,
    openCreateChangePanel,
    getSelectionType,
    clearVisCtx,
    openCreateIssuePanel
};
