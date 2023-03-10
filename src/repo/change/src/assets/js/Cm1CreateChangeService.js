/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Cm1CreateChangeService
 */
import AwPromiseService from 'js/awPromiseService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import dmSvc from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
import soaSvc from 'soa/kernel/soaService';
import showObjectCommandHandler from 'js/showObjectCommandHandler';
import cdm from 'soa/kernel/clientDataModel';
import commandsMapService from 'js/commandsMapService';
import tcSessionData from 'js/TcSessionData';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import cmUtils from 'js/changeMgmtUtils';
import AwStateService from 'js/awStateService';

var exports = {};
//To Do: Need to remove parentData dependency in future
var parentData = {};

var _reviseEventListener = null;

/**
 * flag used to turn on trace level logging
 */
var _debug_logIssuesActivity = browserUtils.getWindowLocationAttributes().logIssuesActivity !== undefined;

/**
 * return Data
 *
 */
export let getData = function() {
    return parentData;
};

/**
 * Select default type if provider has only change type to show in Create Change Panel
 * @param {dataProvider} getCreatableChangeTypesProvider
 */
export let setDefaultSelectedType = function( getCreatableChangeTypesProvider ) {
    getCreatableChangeTypesProvider.changeObjectsSelection( 0, 0, true );
};


/**
 * Store data member for main create change panel which will be used to updated attachement list
 * @param {Object} declViewModel - The create change panel's view model object
 * @returns {Object} showCopyOptions value
 */
let _loadCreateChangeTabData = function( declViewModel ) {
    // Initialize some data
    if( declViewModel.attachments === null || declViewModel.attachments === undefined ) {
        console.log( 'UnExpected NULL attachement found.' );
    }

    // Initialize getAttachments dataProvider
    if( declViewModel.attachments !== undefined && declViewModel.attachments !== null ) {
        declViewModel.dataProviders.getAttachments.update( declViewModel.attachments,
            declViewModel.attachments.length );
    }

    // Check Create Change Panel is for Derive Object or not
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;

    let newShowCopyOptionsData = _.clone( declViewModel.showCopyOptions );

    //Show Copy Option Or not
    if( isDerive ) {
        var selectedChangeObjects = appCtxSvc.ctx.mselected;
        if( selectedChangeObjects && selectedChangeObjects.length === 1 ) {
            var isCopyOptionValid = true;
            if( cmm.isInstanceOf( 'GnProblemReportRevision', selectedChangeObjects[ 0 ].modelType ) && cmUtils.callNewSOAForDerive() === false ) {
                isCopyOptionValid = false;
            }

            if( isCopyOptionValid ) {
                newShowCopyOptionsData.dbValue = true;
            } else {
                newShowCopyOptionsData.dbValue = false;
            }
            cmUtils.populateImplementsSection( selectedChangeObjects, declViewModel );
        }
    }

    //store create change panel data to a variable.
    parentData = declViewModel;

    return {
        showCopyOptions: newShowCopyOptionsData
    };
};

/**
 * Return create input for create change operation.
 *
 * @param {Object} data - The panel's view model object
 * @param {Boolean} isSubmit - Is created object need to be submitted to Workflow
 * @param {Object} editHandler - Edit handler
 * @param {Object} participantInfo- Participant related information
 */
export let getCreateInput = function( data, isSubmit, editHandler, participantInfo ) {
    var deferred = AwPromiseService.instance.defer();

    var soaInput = {};
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;
    if( !isDerive ) {
        soaInput = _getInputForCreateOperation( data, isSubmit, editHandler, participantInfo );
        deferred.resolve( soaInput );
    } else {
        if( cmUtils.callNewSOAForDerive() ) {
            soaInput = _getInputForDeriveOperationNewSOA( data, isSubmit, editHandler );
            deferred.resolve( soaInput );
        } else {
            _getInputForDeriveOperationOldSOA( data, isSubmit, editHandler )
                .then( function( soaInput ) {
                    deferred.resolve( soaInput );
                } );
        }
    }

    return deferred.promise;
};

/**
 * Returns SOA Inputs for Create/Create Submit Change objects
 * @param {Data} data
 * @param {Boolean} isSubmit
 * @param {Object} editHandler
 * @param {Object} participantInfo- Participant related information
 * @returns {Promise} For resolved state returns Soa Input
 */
const _getInputForCreateOperation = function( data, isSubmit, editHandler, participantInfo ) {
    let newData = _.clone( data );

    var deferred = AwPromiseService.instance.defer();
    var soaInput = {};
    var allObjectUid = [];
    var selectedChangeObjects = appCtxSvc.ctx.mselected;
    if( selectedChangeObjects ) {
        selectedChangeObjects = cmUtils.getAdaptedObjectsForSelectedObjects( selectedChangeObjects );
        for( var i = 0; i < selectedChangeObjects.length; ++i ) {
            allObjectUid.push( selectedChangeObjects[ i ].uid );
        }
    }

    // Reset workflow data else Pin panel will always take last value from data.
    // If minimum TC platform version is 142, create input workflow data structure for new SOA.
    // Else, create input as per old structure.
    if ( cmUtils.isTCReleaseAtLeast142() ) {
        newData.workflowData = {
            templateName: '',
            submitToWorkflow: isSubmit,
            additionalWorkflowData: {}
        };
    } else {
        newData.workflowData = {};
        if( isSubmit === true ) {
            newData.workflowData = {
                submitToWorkflow: [ '1' ]
            };
        }
    }

    cmUtils.populateDataToBePopulated( parentData, newData );

    //add cm0InContextObjects property
    //cm0InContextObjects property was added to the create input of ChangeItemRevision in Tc12.2
    //It contains the in context objects for the change being created
    //These objects are created in the change item revision default relation folder
    var isInContextObjectssupported = exports.isSupportedTCVersionForInContextObjects();
    if( isInContextObjectssupported ) {
        //add additional vmo to data.additionalVMProps
        let additionalVMProps = {};
        additionalVMProps.revision__cm0InContextObjects = {};
        additionalVMProps.revision__cm0InContextObjects.propertyName = 'revision__cm0InContextObjects';
        additionalVMProps.revision__cm0InContextObjects.dbValue = [];
        if( selectedChangeObjects ) {
            for( var k = 0; k < selectedChangeObjects.length; k++ ) {
                if( cmm.isInstanceOf( 'BOMLine',
                    selectedChangeObjects[ k ].modelType ) ) {
                    additionalVMProps.revision__cm0InContextObjects.dbValue.push( selectedChangeObjects[ k ].props.bl_revision.dbValues );
                } else{
                    additionalVMProps.revision__cm0InContextObjects.dbValue.push( selectedChangeObjects[ k ].uid );
                }
            }
        }

        additionalVMProps.revision__cm0InContextObjects.valueUpdated = true;
        additionalVMProps.revision__cm0InContextObjects.isArray = true;

        //selectedResponsibleUser property work for Plant Problem Report.
        //It will get pushed in compound create input i.e. 'participants' property on pdm1ProblemItemRevision BO.
        if( newData.dataProviders.getAssignedResponsibleUser.viewModelCollection.loadedVMObjects && newData.dataProviders.getAssignedResponsibleUser.viewModelCollection.loadedVMObjects.length > 0 ) {
            additionalVMProps.revision__participants = {};
            additionalVMProps.revision__participants.propertyName = 'revision__participants';
            additionalVMProps.revision__participants.dbValue = [];
            additionalVMProps.revision__participants.dbValue.push( newData.dataProviders.getAssignedResponsibleUser.viewModelCollection.loadedVMObjects[ 0 ].uid );
            additionalVMProps.revision__participants.valueUpdated = true;
            additionalVMProps.revision__participants.isArray = true;
        }

        //qa0FindingGuideline "Audit Finding Guideline" (used in Qa0QualityAudit template)
        if( newData.qa0FindingGuideline && newData.qa0FindingGuideline.dbValue !== '' ) {
            additionalVMProps.qa0FindingGuideline = {};
            additionalVMProps.qa0FindingGuideline.dbValue = [];
            additionalVMProps.qa0FindingGuideline.dbValue.push( newData.qa0FindingGuideline.dbValue );
            additionalVMProps.qa0FindingGuideline.valueUpdated = true;
            additionalVMProps.qa0FindingGuideline.isArray = false;
        }

        newData.additionalVMProps = additionalVMProps;
    }

    //since without objCreateInfo, we need set creationType
    newData.creationType = newData.selectedType.dbValue;
    var returnedinput = cmUtils.getCreateInputFromDerivePanel( newData, 'CREATE', editHandler, participantInfo );

    //This will create change object in selected folder. In case of Change Incontext or Derive It will create change object in changes tab
    if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        returnedinput[ 0 ].pasteProp = 'contents';
        var targetObject = {
            uid: appCtxSvc.ctx.selected.uid,
            type: 'Folder'
        };
        returnedinput[ 0 ].targetObject = targetObject;
    }

    soaInput = returnedinput;

    deferred.resolve( soaInput );
    return deferred.promise;
};


/**
 * This method is used to get the DeriveInput from getDeepCopyData SOA
 * @param {Object} selectedChangeObject the object to get deepcopydata
 * @param {Boolean} isSubmit
 * @param {Object} editHandler
 * @returns {Object} DeepCopy Rules
 */
var _getInputForDeriveOperationNewSOA = function( data, isSubmit, editHandler ) {
    var deferred = AwPromiseService.instance.defer();
    var soaInput = {};
    var workflowString = '';
    var isPropagateRelation = true;

    //selected change objects which needs to be derived.
    var selectedChangeObjectsToDerive = appCtxSvc.ctx.mselected;
    var selectedChangeObjectsToDeriveUids = [];
    _.forEach( selectedChangeObjectsToDerive, function( vmo ) {
        var sObject = {
            type: vmo.type,
            uid: vmo.uid
        };
        selectedChangeObjectsToDeriveUids.push( sObject );
    } );

    //set cm0DerivedFrom to data so that getCreateInputForDerive method will populate create Input.
    let additionalVMProps = {};
    additionalVMProps.revision__cm0DerivedFrom = {};
    additionalVMProps.revision__cm0DerivedFrom.propertyName = 'revision__cm0DerivedFrom';
    additionalVMProps.revision__cm0DerivedFrom.dbValue = [];
    for( var k = 0; k < selectedChangeObjectsToDerive.length; k++ ) {
        additionalVMProps.revision__cm0DerivedFrom.dbValue.push( selectedChangeObjectsToDerive[ k ].uid );
    }
    additionalVMProps.revision__cm0DerivedFrom.valueUpdated = true;
    additionalVMProps.revision__cm0DerivedFrom.isArray = true;
    data.additionalVMProps = additionalVMProps;

    //since without objCreateInfo, we need set creationType
    data.creationType = data.selectedType.dbValue;

    // Initializing workflow data, this will be used in getCreateInputFromDerivePanel to populate workflowData.
    data.workflowData = {};

    //Get input property from panel.
    var deriveCreateInput = cmUtils.getCreateInputFromDerivePanel( data, null, editHandler  );
    var derivePropertyData;
    if( deriveCreateInput.boName !== undefined ) {
        derivePropertyData = deriveCreateInput;
    } else if( deriveCreateInput.length > 0 ) {
        derivePropertyData = deriveCreateInput[0].createData;

        // Get workflow data from Derive Panel.
        data.workflowData = deriveCreateInput[0].workflowData;
    }

    // Get workflow template information from workflowData.
    if ( data.workflowData && data.workflowData.templateName && data.workflowData.templateName !== '' ) {
        workflowString = data.workflowData.templateName;
    }

    //This is for a PR fix when revision_id was not present on stylesheet. if revision property is not present than also we need to return cm0DerivableFrom
    if( !derivePropertyData.compoundDeriveInput.revision ) {
        var typeName = data.selectedType.dbValue + 'Revision';
        var derivedFromObjects = [];
        for( var k = 0; k < selectedChangeObjectsToDerive.length; k++ ) {
            derivedFromObjects.push( selectedChangeObjectsToDerive[ k ].uid );
        }
        var revision = {
            boName: typeName,
            propertyNameValues: {
                cm0DerivedFrom: derivedFromObjects
            }
        };
        derivePropertyData.compoundDeriveInput.revision = [];
        derivePropertyData.compoundDeriveInput.revision[ 0 ] = revision;
    }

    //we only process deepcopy in case of single select Derive from ECR to ECN
    var processDeepCopy = false;
    if( appCtxSvc.ctx.mselected.length === 1 ) {
        processDeepCopy = true;
    }

    var deepCopyDatas = [];
    var deepCopyDataForType = appCtxSvc.ctx.deepCopyData;

    if( appCtxSvc.ctx && appCtxSvc.ctx.deriveRelationsDataProviders && processDeepCopy ) {
        var deriveRelationProviders = appCtxSvc.ctx.deriveRelationsDataProviders;
        if( deriveRelationProviders && deriveRelationProviders.length > 0 ) {
            for( var i = 0; i < deriveRelationProviders.length; i++ ) {
                var deriveRelProvider = deriveRelationProviders[ i ];
                var relName = deriveRelProvider.relationName;

                for( var a in deepCopyDataForType ) {
                    var deepCopyRelation = deepCopyDataForType[ a ].propertyValuesMap.propertyName[ 0 ];
                    if( relName !== deepCopyRelation ) {
                        continue;
                    }

                    var dataProvider = deriveRelProvider.dataProvider;
                    var selectedObjects = dataProvider.selectedObjects;

                    var selectedObjectUids = [];
                    if( selectedObjects && selectedObjects.length > 0 ) {
                        for( var j = 0; j < selectedObjects.length; j++ ) {
                            selectedObjectUids.push( selectedObjects[ j ].uid );
                        }
                    }

                    var deepCopyObjUid = deepCopyDataForType[ a ].attachedObject.uid;
                    var found = selectedObjectUids.includes( deepCopyObjUid );
                    if( !found ) { // we only pass information about object which are not selected. selected object will be processed as per deepcopy rule.
                        //set deepcopy action as NoCopy for non-selected objects
                        deepCopyDataForType[ a ].propertyValuesMap.copyAction[ 0 ] = 'NoCopy';

                        var attachedObjectUid = {
                            type: deepCopyDataForType[ a ].attachedObject.type,
                            uid: deepCopyDataForType[ a ].attachedObject.uid
                        };
                        var deepCopyData = {
                            attachedObject: attachedObjectUid,
                            deepCopyProperties: deepCopyDataForType[ a ].propertyValuesMap,
                            operationInputType: deepCopyDataForType[ a ].operationInputTypeName,
                            childDeepCopyData: deepCopyDataForType[ a ].childDeepCopyData,
                            inputProperties: deepCopyDataForType[ a ].operationInputs
                        };
                        deepCopyDatas.push( deepCopyData );
                    }
                }
            }
        }
    }

    soaInput = {
        selectedObjects: selectedChangeObjectsToDeriveUids,
        derivePropertyData,
        deepCopyDatas,
        submitToWorkflow: isSubmit,
        workflowTemplateName: workflowString,
        propagateRelation: isPropagateRelation
    };

    deferred.resolve( soaInput );

    return deferred.promise;
};

/**
 * Return deriveOptions in input for derive operation of CAPA.
 * @param {Object} data - The panel's view model object
 */
export let getDeriveOptions = function( data ) {
    var selectedSymptomDefect = data.dataProviders.getSymptomDefectProvider.viewModelCollection.loadedVMObjects[ 0 ];
    var copyAction = Boolean( data.subPanelContext.sharedData.selectedObjects && data.subPanelContext.sharedData.selectedObjects.deriveType && data.subPanelContext.sharedData.selectedObjects.deriveType.dbValue === 'Duplicate' ||  appCtxSvc.ctx.selected.modelType.typeHierarchyArray.indexOf( 'C2CapaRevision' ) > -1 );
    var UID = selectedSymptomDefect ? selectedSymptomDefect.uid : 'AAAAAAA';
    var attachedObjectUid = {
        type: 'CAW0Defect',
        uid: UID
    };
    return {
        targetObject: attachedObjectUid,
        targetRelation: 'CPA0ProblemDescription',
        targetAsDuplicate: copyAction
    };
};

/**
 * Return create input for create change operation.
 *
 * @param {Object} data - The panel's view model object
 * @param {Boolean} isSubmit
 */
var _getInputForDeriveOperationOldSOA = function( data, isSubmit, editHandler ) {
    var deferred = AwPromiseService.instance.defer();
    var allObjectUid = [];
    var selectedChangeObjects = appCtxSvc.ctx.mselected;
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;
    var ismultiSelectDerive = false;
    if( isDerive && appCtxSvc.ctx.mselected.length > 1 &&
        commandsMapService.isInstanceOf( 'GnChangeRequestRevision', appCtxSvc.ctx.selected.modelType ) ) {
        ismultiSelectDerive = true;
    }

    var relationsToPropagate = [];

    if( ismultiSelectDerive ) {
        relationsToPropagate = appCtxSvc.ctx.relationToPropagate;
    }

    for( var i = 0; i < selectedChangeObjects.length; ++i ) {
        allObjectUid.push( selectedChangeObjects[ i ].uid );
    }
    dmSvc
        .getProperties( allObjectUid, relationsToPropagate )
        .then(
            function() {
                //Reset workflow data else Pin panel will always take last value from data.
                data.workflowData = {};

                if( isSubmit === true ) {
                    data.workflowData = {
                        submitToWorkflow: [ '1' ]
                    };
                }
                // For derive add cm0DerivedFrom property on revision create input.
                //add cm0DeriveFrom property
                let additionalVMProps = {};
                additionalVMProps.revision__cm0DerivedFrom = {};
                additionalVMProps.revision__cm0DerivedFrom.propertyName = 'revision__cm0DerivedFrom';
                additionalVMProps.revision__cm0DerivedFrom.dbValue = [];
                var selectedChangeObjects = appCtxSvc.ctx.mselected;
                for( var k = 0; k < selectedChangeObjects.length; k++ ) {
                    additionalVMProps.revision__cm0DerivedFrom.dbValue.push( selectedChangeObjects[ k ].uid );
                }

                additionalVMProps.revision__cm0DerivedFrom.valueUpdated = true;
                additionalVMProps.revision__cm0DerivedFrom.isArray = true;
                data.additionalVMProps = additionalVMProps;

                //add relation from copy option panel
                data.dataToBeRelated = {};

                if( appCtxSvc.ctx && appCtxSvc.ctx.deriveRelationsDataProviders && appCtxSvc.ctx.mselected.length === 1 ) {
                    var deriveRelationProviders = appCtxSvc.ctx.deriveRelationsDataProviders;

                    if( deriveRelationProviders && deriveRelationProviders.length > 0 ) {
                        for( var i = 0; i < deriveRelationProviders.length; i++ ) {
                            var deriveRelProvider = deriveRelationProviders[ i ];
                            var relName = deriveRelProvider.relationName;

                            var dataProvider = deriveRelProvider.dataProvider;
                            var selectedObjects = dataProvider.selectedObjects;

                            var selectedObjectUids = [];
                            if( selectedObjects && selectedObjects.length > 0 ) {
                                for( var j = 0; j < selectedObjects.length; j++ ) {
                                    selectedObjectUids.push( selectedObjects[ j ].uid );
                                }
                            }

                            if( selectedObjectUids.length > 0 ) {
                                data.dataToBeRelated[ relName ] = selectedObjectUids;
                            }
                        }
                    }
                    appCtxSvc.ctx.deriveRelationsDataProviders = [];
                } else if( appCtxSvc.ctx.mselected.length > 1 &&
                    commandsMapService.isInstanceOf( 'GnChangeRequestRevision',
                        appCtxSvc.ctx.selected.modelType ) ) {
                    var allObjectUid = [];
                    var selectedChangeObjects = appCtxSvc.ctx.mselected;
                    var relationsToPropagate = appCtxSvc.ctx.relationToPropagate;
                    for( var i = 0; i < selectedChangeObjects.length; ++i ) {
                        allObjectUid.push( selectedChangeObjects[ i ].uid );
                    }

                    for( var i in relationsToPropagate ) {
                        if( relationsToPropagate[ i ] !== '' ) {
                            var relName = relationsToPropagate[ i ];
                            var selectedObjectUids = [];

                            for( var j = 0; j < selectedChangeObjects.length; ++j ) {
                                selectedChangeObjects[ j ] = cdm.getObject( selectedChangeObjects[ j ].uid );
                                if( selectedChangeObjects[ j ].props[ relName ] ) {
                                    var numOfRelatedObjects = selectedChangeObjects[ j ].props[ relName ].dbValues.length;
                                    for( var k = 0; k < numOfRelatedObjects; ++k ) {
                                        selectedObjectUids
                                            .push( selectedChangeObjects[ j ].props[ relName ].dbValues[ k ] );
                                    }
                                }
                            }

                            if( selectedObjectUids.length > 0 ) {
                                data.dataToBeRelated[ relName ] = selectedObjectUids;
                            }
                        }
                    }
                }

                //since without objCreateInfo, we need set creationType
                data.creationType = data.selectedType.dbValue;
                var returnedinput = cmUtils.getCreateInputFromDerivePanel( data, null, editHandler  );

                if( !returnedinput[ 0 ].createData.compoundCreateInput.revision ) {
                    var typeName = data.selectedType.dbValue + 'Revision';
                    var derivedFromObjects = [];
                    for( var k = 0; k < selectedChangeObjects.length; k++ ) {
                        derivedFromObjects.push( selectedChangeObjects[ k ].uid );
                    }
                    var revision = {
                        boName: typeName,
                        propertyNameValues: {
                            cm0DerivedFrom: derivedFromObjects
                        }
                    };
                    returnedinput[ 0 ].createData.compoundCreateInput.revision = [];
                    returnedinput[ 0 ].createData.compoundCreateInput.revision[ 0 ] = revision;
                }

                //This will create change object in selected folder. In case of Change Incontext or Derive It will create change object in changes tab
                if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
                    returnedinput[ 0 ].pasteProp = 'contents';
                    var targetObject = {
                        uid: appCtxSvc.ctx.selected.uid,
                        type: 'Folder'
                    };
                    returnedinput[ 0 ].targetObject = targetObject;
                }
                deferred.resolve( returnedinput );
            } );

    return deferred.promise;
};

/**
 * Action handler used by BIOS service for creating IssueReports for hosted AW. Get typename for object type to
 * create from the CreateIssueHostedMode context.
 *
 * @param {Object} data - The panel's view model object
 *
 * @returns {Promise} Resolved when 'data' is set with
 */
export let handleHostedModeIssueTypeCreation = function( data ) {
    var hostedMode = appCtxSvc.getCtx( 'CreateIssueHostedMode' );
    var issueTypeName = 'IssueReport';
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + 'Entered Cm1CreateChangeService::handleHostedModeIssueTypeCreation' );
    }
    if( hostedMode ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'CreateIssueHostedMode ctx exists.' );
        }
        if( hostedMode.IssueTypeName ) {
            issueTypeName = hostedMode.IssueTypeName;
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'Supplied IssueTypeName = \'' + issueTypeName + '\'' );
            }
        }
    }
    var modelType = cmm.getType( issueTypeName );
    if( modelType ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'We were able to obtain modelType for ' + issueTypeName );
            logger.info( 'hostIssues: ' + 'modelType displayName is \'' + modelType.displayName + '\'' );
        }
        data.selectedType.dbValue = issueTypeName;
        data.selectedTypeDisplayName.dbValue = modelType.displayName;
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'About to call uwPropertyService.createViewModelProperty.' );
        }
        var vmProperty = uwPropertyService.createViewModelProperty( issueTypeName, modelType.displayName, 'STRING', '', '' );
        if( !vmProperty ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'createViewModelProperty did not return a vmProperty.' );
            }
        }
        data.displayedType = vmProperty;
        return AwPromiseService.instance.resolve();
    }
    return soaSvc.ensureModelTypesLoaded( [ issueTypeName ] ).then( function() {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'Had to call ensureModelTypesLoaded and it succeeded.' );
        }
        var modelType = cmm.getType( issueTypeName );
        if( modelType ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'We were able to obtain modelType for ' + issueTypeName );
                logger.info( 'hostIssues: ' + 'modelType displayName is \'' + modelType.displayName + '\'' );
            }
            data.selectedType.dbValue = issueTypeName;
            data.selectedTypeDisplayName.dbValue = modelType.displayName;

            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'About to call uwPropertyService.createViewModelProperty.' );
            }
            var vmProperty = uwPropertyService.createViewModelProperty( issueTypeName, modelType.displayName, 'STRING', '', '' );

            if( !vmProperty ) {
                if( _debug_logIssuesActivity ) {
                    logger.info( 'hostIssues: ' + 'createViewModelProperty did not return a vmProperty.' );
                }
            }
            data.displayedType = vmProperty;
        } else {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'Had to call ensureModelTypesLoaded and it failed.' );
            }
            return AwPromiseService.instance.reject( 'Unknown issueTypeName: ' + issueTypeName );
        }
    } );
};

/**
 * Check if user is trying to create simple change object and based on that return true or false.
 *
 * @param {Object} selectedType Type object that need to be created
 *
 * @returns {boolean} True/False based on simple change object in creation or not.
 */
var _isSimpleChangeObjectCreation = function( selectedType ) {
    var isCreateSimpleChange = false;
    if( !selectedType || !selectedType.props || !selectedType.props.type_name ) {
        return isCreateSimpleChange;
    }
    isCreateSimpleChange = selectedType.props.type_name.dbValue === 'Cm0SimpleChange' ||
    selectedType.props.parent_types && selectedType.props.parent_types.dbValues.indexOf( 'TYPE::Cm0SimpleChange::Cm0SimpleChange::ChangeNotice' ) > -1;
    return isCreateSimpleChange;
};

/**
 * When user select type from type selection panel of change we need to navigate to create form. This method
 * will set few variable to hide type selector panel and to show create form.
 *
 * @param {Object} data - The panel's view model object
 */
export let handleTypeSelectionJs = function( data, selectedTypeObject ) {
    let selectedTypeObj = data.dataProviders.getCreatableChangeTypes.selectedObjects;

    if( selectedTypeObj && selectedTypeObj.length > 0 ) {
        selectedTypeObject.update( selectedTypeObj[0] );
    }
};

/**
 * This method will populate form in Create Change panel based on selected type recieved.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} selectedTypeObject - Selected type for which we need to show create form
 */
export let getTypeSelectedInformation = function( data, selectedTypeObject ) {
    let newBoTypeConst = _.clone( data.boTypeConst );

    let newOpenNewChangeData = _.clone( data.openNewChange );
    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.CM_open_change_on_create && appCtxSvc.ctx.preferences.CM_open_change_on_create.length !== 0 ) {
        newOpenNewChangeData.dbValue = appCtxSvc.ctx.preferences.CM_open_change_on_create[0] === 'true';
        newOpenNewChangeData.uiValue = newOpenNewChangeData.dbValue;
    }

    // Set 'Set as Active Change' checkbox based on CM_set_active_change_on_create preference value.
    let newSetActiveChangeData = _.clone( data.setActiveChange );

    // Set dbValue for setActiveChange checkbox, It is required to set dbValue else form validation will fail.
    newSetActiveChangeData.dbValue = false;

    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.CM_set_active_change_on_create && appCtxSvc.ctx.preferences.CM_set_active_change_on_create.length !== 0 ) {
        newSetActiveChangeData.dbValue = appCtxSvc.ctx.preferences.CM_set_active_change_on_create[0] === 'true';
    }

    data.isSimpleChangeObjectCreation = false;
    let processTemplatePropName = '';

    if( selectedTypeObject ) {
        data.selectedType.dbValue = selectedTypeObject.props.type_name.dbValue;
        data.selectedTypeDisplayName.dbValue = selectedTypeObject.props.object_string.dbValue;
        if( selectedTypeObject.props.parent_types ) {
            data.parent_types.dbValue = selectedTypeObject.props.parent_types.dbValue;
        }
        data.isSimpleChangeObjectCreation = _isSimpleChangeObjectCreation( selectedTypeObject );
        var vmProperty = uwPropertyService.createViewModelProperty( selectedTypeObject.props.object_string.dbValue,
            selectedTypeObject.props.object_string.dbValue, 'STRING', '', '' );

        // Explicitly setting dbValue as the above API returns it "" by default as opposed to the selected value.
        // Git issue 799 (https://gitlab.industrysoftware.automation.siemens.com/Apollo/swf/-/issues/799) is tracking this issue.
        vmProperty.dbValue = data.selectedType.dbValue;
        data.displayedType = vmProperty;
        //Get Type Constant to hide Submit button
        var getTypeConstInput = [];
        getTypeConstInput.push( {
            typeName: data.selectedType.dbValue,
            constantName: 'Awp0EnableSubmitForCreate'
        } );
        // adding to Awp0EnableCreateForCreatePanel : getTypeConstInput LCS-139108
        getTypeConstInput.push( {
            typeName: data.selectedType.dbValue,
            constantName: 'Awp0EnableCreateForCreatePanel'
        } );
        //Get create input from constants map
        var creIType = cmm.getType( data.selectedType.dbValue );
        var createInputTypeName = data.selectedType.dbValue;
        if( creIType ) {
            createInputTypeName = creIType.constantsMap.CreateInput;
        }

        // adding to Fnd0EnableAssignProjects : getTypeConstInput
        getTypeConstInput.push( {
            typeName: createInputTypeName,
            constantName: 'Fnd0EnableAssignProjects'
        } );


        //For Simple Change, we don't want to show "Dataset" in attachement panel.
        if ( data.isSimpleChangeObjectCreation ) {
            var attachementTypeStringWithComma = '';
            attachementTypeStringWithComma = appCtxSvc.getCtx( 'CreateChangePanel.typesForAttachement' );
            var attachementTypeArray = attachementTypeStringWithComma.split( ',' );
            if ( attachementTypeArray && attachementTypeArray.length > 0 ) {
                const index = attachementTypeArray.indexOf( 'Dataset' );
                if ( index > -1 ) {
                    attachementTypeArray.splice( index, 1 );
                }

                var attachmentTypes = '';
                for ( var j = 0; j < attachementTypeArray.length; j++ ) {
                    attachmentTypes += attachementTypeArray[j];
                    if ( j !== attachementTypeArray.length - 1 ) {
                        attachmentTypes += ',';
                    }
                }

                appCtxSvc.updatePartialCtx( 'CreateChangePanel.typesForAttachement', attachmentTypes );
            }
        }

        newBoTypeConst.isEnableAssignProjects.dbValue = true;
        newBoTypeConst.showSubmitButton.dbValue = true;

        if ( data.isSimpleChangeObjectCreation ) {
            newBoTypeConst.showCreateButton.dbValue = false;
        } else{
            newBoTypeConst.showCreateButton.dbValue = true;
        }

        // Get awp0ProcessTemplates property name from selectedType, It will be used in Create button visibility condition.
        processTemplatePropName = `REF(revision,${data.selectedType.dbValue}RevisionCreI).awp0ProcessTemplates`;
    } else {
        data.selectedType.dbValue = '';
        data.selectedTypeDisplayName.dbValue = '';
        data.parent_types.dbValue = [];
    }

    return {
        boTypeConst:newBoTypeConst,
        getTypeConstInput:getTypeConstInput,
        selectedType: data.selectedType,
        displayedType: data.displayedType,
        openNewChange: newOpenNewChangeData,
        setActiveChange: newSetActiveChangeData,
        isSimpleChangeObjectCreation: data.isSimpleChangeObjectCreation,
        processTemplatePropName: processTemplatePropName
    };
};


/**
 * Clear selected type when user click on type link on create form
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let clearSelectedType = function( data ) {
    data.selectedType.dbValue = '';
    data.selectedTypeDisplayName.dbValue = '';
    data.parent_types.dbValue = [];
    return {
        selectedType: data.selectedType,
        selectedTypeDisplayName: data.selectedTypeDisplayName,
        parent_types: data.parent_types
    };
};

/**
 * Initialize variables and methods when create change panle is loaded.
 *
 * @param {Object} data - data
 */
export let initializeCreateChangePanel = function( data ) {
    //reset attachement variables.
    if( !data.attachments ) {
        data.attachments = [];
    } else {
        data.attachments.splice( 0, data.attachments.length );
    }
    if( !data.attachmentsUids ) {
        data.attachmentsUids = [];
    } else {
        data.attachmentsUids.splice( 0, data.attachmentsUids.length );
    }
    //If this is create change in context show selected objects in attachement panel.
    if( appCtxSvc.ctx && appCtxSvc.ctx.CreateChangePanel ) {
        var selectedObjects = appCtxSvc.ctx.CreateChangePanel.selectedObjects;
        if( selectedObjects && selectedObjects.length > 0 ) {
            for( var i = 0; i < selectedObjects.length; i++ ) {
                if( selectedObjects[ i ] !== null && selectedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Folder' ) <= -1 ) {
                    data.attachments.push( selectedObjects[ i ] );
                    data.attachmentsUids.push( selectedObjects[ i ].uid );
                }
            }
        }
    }

    //Updating getAttachments provider
    let { showCopyOptions: newShowCopyOptionsData } = _loadCreateChangeTabData( data );

    let newAttachment = _.clone( data.attachments );
    let newAttachmentUids = _.clone( data.attachmentsUids );

    return{
        attachments:newAttachment,
        attachmentsUids:newAttachmentUids,
        showCopyOptions: newShowCopyOptionsData
    };
};

/**
 * Get input for creatable change type
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let getInputForCreatableChangeType = function( data ) {
    //Get SOA input
    var creatableChangeTypeInput = [];
    if( appCtxSvc.ctx && appCtxSvc.ctx.CreateChangePanel ) {
        var selectedObjects = appCtxSvc.ctx.CreateChangePanel.selectedObjects;
        if( selectedObjects && selectedObjects.length > 0 ) {
            for( var i = 0; i < selectedObjects.length; i++ ) {
                if( selectedObjects[ i ] !== null ) {
                    var input = {
                        baseTypeName: appCtxSvc.ctx.CreateChangePanel.baseType,
                        clientId: '',
                        exclusionTypeNames: [],
                        object: selectedObjects[ i ].uid
                    };
                    creatableChangeTypeInput.push( input );
                }
            }
        } else {
            var input2 = {
                baseTypeName: appCtxSvc.ctx.CreateChangePanel.baseType,
                clientId: '',
                exclusionTypeNames: [],
                object: ''
            };
            creatableChangeTypeInput.push( input2 );
        }
    }
    return creatableChangeTypeInput;
};

export let getInputForAssignAndRemoveObjectsSOA = function( data ) {
    if( data.derivedObjectUid ) {
        let uid = data.derivedObjectUid;
        let requiredObj = cdm.getObject( uid );
        data.createdChangeObject = requiredObj;
    }
    return [ data.createdChangeObject ];
};

/**
 * Process returned type
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let processResponseForTypeNames = function( response, data ) {
    let displayableChangeTypes = [];
    for( let inx = 0; inx < response.output.length; inx++ ) {
        const outputTypesList = response.output[ inx ];
        const allowedChangeTypesList = outputTypesList.allowedChangeTypes;
        if( allowedChangeTypesList && allowedChangeTypesList.length > 0 ) {
            for( let i = 0; i < allowedChangeTypesList.length; i++ ) {
                displayableChangeTypes.push( allowedChangeTypesList[ i ].typeName );
            }
        }
    }
    //get Unique type list from list of types
    displayableChangeTypes = _.uniq( displayableChangeTypes, true );
    return displayableChangeTypes;
};

/**
 * ensure types are present in cache
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let ensureChangeTypesLoadedJs = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var returnedTypes = [];
    var displayableChangeTypes;
    if( data.changeTypeNames !== undefined ) {
        displayableChangeTypes = data.changeTypeNames;
    }
    var promise = soaSvc.ensureModelTypesLoaded( displayableChangeTypes );
    if( promise ) {
        promise.then( function() {
            var typeUids = [];
            for( var i = 0; i < displayableChangeTypes.length; i++ ) {
                var modelType = cmm.getType( displayableChangeTypes[ i ] );

                if( cmUtils.filterSearch( data.filterBox.dbValue, modelType.displayName ) ) {
                    returnedTypes.push( modelType );
                    typeUids.push( modelType.uid );
                }
            }
            //ensure the ImanType objects are loaded
            propertyPolicySvc.register( {
                types: [ {
                    name: 'ImanType',
                    properties: [ {
                        name: 'parent_types'
                    }, {
                        name: 'type_name'
                    } ]
                } ]
            } );
            dmSvc.loadObjects( typeUids ).then( function() {
                // Updating getCreatableChangeTypes dataProvider
                data.dataProviders.getCreatableChangeTypes.update( returnedTypes, returnedTypes.length );

                var returneddata = {
                    searchResults: returnedTypes,
                    totalFound: returnedTypes.length
                };

                deferred.resolve( returneddata );
            } );
        } );
    }
    return deferred.promise;
};

/**
 * GetCreatable Change Types when performing a create issue from hosted AW
 *
 * @param {Object} data - view model data
 */
export let getCreatableChangeTypesProvided = function() {
    var providedTypeName = '';
    if( appCtxSvc.ctx.CreateIssueHostedMode && appCtxSvc.ctx.CreateIssueHostedMode.IssueTypeName ) {
        providedTypeName = appCtxSvc.ctx.CreateIssueHostedMode.IssueTypeName;
    } else {
        if( appCtxSvc.ctx.CreateChangePanel.exactTypeToCreate && appCtxSvc.ctx.CreateChangePanel.baseTypeForDeriv !== '' ) {
            providedTypeName = appCtxSvc.ctx.CreateChangePanel.exactTypeToCreate;
        } else if( appCtxSvc.ctx.CreateChangePanel.baseType && appCtxSvc.ctx.CreateChangePanel.baseType !== '' ) {
            providedTypeName = appCtxSvc.ctx.CreateChangePanel.baseType;
        }
    }

    var newChangeTypeNames = [];
    newChangeTypeNames.push( providedTypeName );
    return newChangeTypeNames;
};


/**
 * getDeriveData
 *
 * @param {Object} data - view model data
 */
export let getDeriveData = function( response ) {
    var selectedChangeObjectsUid = response.plain;

    let newChangeTypeNames = [];

    var selectedChangeObjects = [];
    for ( let uid of selectedChangeObjectsUid ) {
        var selectedChange = response.modelObjects[uid];
        selectedChangeObjects.push( selectedChange );
    }

    var initialTypes = [];
    var initialTypes = cmUtils.getInitialChangeTypesForDerivePanel( initialTypes, selectedChangeObjects );

    for ( var i in initialTypes ) {
        if ( initialTypes[i] !== '' && initialTypes[i] !== null ) {
            var typeString = initialTypes[i];
            var parsedStr = typeString.split( '/' );
            var actualTypeName = parsedStr[0];
            newChangeTypeNames.push( actualTypeName );
        }
    }
    var selectedChangeObject = selectedChangeObjects[0];
    if ( selectedChangeObject.props.cm0RelationsToPropagate.dbValues ) {
        appCtxSvc.updatePartialCtx( 'relationToPropagate', selectedChangeObject.props.cm0RelationsToPropagate.dbValues );
    }
    // cm0AutoPropagateRelations.dbValue/dbValues has string value- "0"/"1"
    // and is not evaluated correcty based on its logical value
    // fixing for a defect.

    if ( selectedChangeObject.props.cm0AutoPropagateRelations.dbValue ) {
        var isAutoPropagate = selectedChangeObject.props.cm0AutoPropagateRelations.dbValue;
        var autoPropagRel = _.isString( isAutoPropagate ) ? cmUtils.isPropertyValueTrue( isAutoPropagate ) : isAutoPropagate;
        appCtxSvc.updatePartialCtx( 'autoPropagateRel', autoPropagRel );
    } else {
        if ( selectedChangeObject.props.cm0AutoPropagateRelations.dbValues &&
            selectedChangeObject.props.cm0AutoPropagateRelations.dbValues.length > 0 ) {
            var isAutoPropagate = selectedChangeObject.props.cm0AutoPropagateRelations.dbValues[0];
            var autoPropagRel = _.isString( isAutoPropagate ) ? cmUtils.isPropertyValueTrue( isAutoPropagate ) : isAutoPropagate;
            appCtxSvc.updatePartialCtx( 'autoPropagateRel', autoPropagRel );
        }
    }

    return newChangeTypeNames;
};


/**
 *  Update data provider with Responsible User.
 *  @param {Object} selectedObjects - Selected Responsible User
 */
export let updateResponsibleUserDataProvider = function( dataProviderToUpdate, selecedResources ) {
    if( selecedResources && dataProviderToUpdate ) {
        let allResources = [];
        allResources.push( selecedResources[0] );
        //Update data provider.
        dataProviderToUpdate.update( allResources );
    }
};

/**
 *  Remove Responsible User from the dataProvider when user clicked on 'Remove Responsible User' button.
 *  @param {Object} dataProvider - dataProvider
 */
export let removeResponsibleUser = function( dataProvider ) {
    if( dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        let allResources = [];
        dataProvider.update( allResources, 0 );
    }
};

/**
 * Remove given attachment from attachment list.
 *
 * @param {String} data - The view model data
 * @param {String} attachment - The attachment to be removed
 */
export let removeAttachementJs = function( selectedAttachement ) {
    if( selectedAttachement && selectedAttachement.length > 0 ) {
        if( parentData.attachments && parentData.attachmentsUids ) {
            for( var i = 0; i < selectedAttachement.length; i++ ) {
                var index = parentData.attachmentsUids.indexOf( selectedAttachement[ i ].uid );
                if( index > -1 ) {
                    parentData.attachments.splice( index, 1 );
                    parentData.attachmentsUids.splice( index, 1 );
                }
            }
        }

        if( parentData.dataProviders && parentData.dataProviders.getAttachments ) {
            parentData.dataProviders.getAttachments.update( parentData.attachments,
                parentData.attachments.length );
        }
    }
};

/**
 * SelectAll/ClearAll currently loaded related objects
 *
 * @param {Object} data - view model data
 * @param {String} selectionMode - Selection Mode
 */
export let selectCells = function( data, selectionMode ) {
    if( selectionMode === 'selectAll' ) {
        data.dataProviders.getPropagateRelationProvider.selectAll();
    } else if( selectionMode === 'selectNone' ) {
        data.dataProviders.getPropagateRelationProvider.selectNone();
    }
};

/**
 * handle selection event in relation list to update count label.
 *
 * @param {Object} data - view model data
 */
export let handleSelectionModel = function( data ) {
    let newCanSelectAll = _.clone( data.canSelectAll );
    let newCanDeselectAll = _.clone( data.canDeselectAll );
    let newCountLabel = _.clone( data.countLabel );
    data.dataProviders.getPropagateRelationProvider.selectionModel
        .evaluateSelectionStatusSummary( data.dataProviders.getPropagateRelationProvider );
    newCanSelectAll.dbValue = data.dataProviders.getPropagateRelationProvider.selectionModel
        .getCanExecuteSelectLoaded();
    newCanDeselectAll.dbValue = data.dataProviders.getPropagateRelationProvider.selectionModel
        .getCanExecuteDeselect();
    var selectedCount = data.dataProviders.getPropagateRelationProvider.selectionModel
        .getCurrentSelectedCount();
    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var countLabel = localTextBundle.countLabel;
    countLabel = countLabel.replace( '{0}', selectedCount );
    countLabel = countLabel.replace( '{1}',
        data.dataProviders.getPropagateRelationProvider.viewModelCollection.totalFound );
    var countDisplayProp = newCountLabel;
    countDisplayProp.propertyDisplayName = countLabel;
    newCountLabel = countDisplayProp;
    return{
        canSelectAll:newCanSelectAll,
        canDeselectAll:newCanDeselectAll,
        countLabel:newCountLabel
    };
};


/**
 * Initialize default values in case of derive operation.
 *
 * @param {Object} data - view model data
 */
export let initializeDefaultValues = function( data, editHandler ) {
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;
    if( isDerive ) {
        cmUtils.populateCreatePanelPropertiesOnDerive( data, editHandler );
    }
};

/**
 * Open Object in Edit Mode.
 *
 * @param {String} newObjectUid - object to open ( uid or object it self )
 */
export let openNewObjectInEditMode = function( data ) {
    var uidToConsider = '';
    if( data.derivedObjectUid ) {
        uidToConsider = data.derivedObjectUid;
    } else {
        uidToConsider = data.createdChangeObject.uid;
    }
    var vmo = cdm.getObject( uidToConsider );
    var isSelectedObjectSupportInContext = false;
    var isCreatedObjectSupportInContext = false;
    var openInEdit = true;
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        if( params.uid ) {
            var openedObjectUid = params.uid;
            var openObjecyVmo = cdm.getObject( openedObjectUid );
            if( openObjecyVmo && cmm.isInstanceOf( 'Cpd0CollaborativeDesign', openObjecyVmo.modelType ) ) {
                isSelectedObjectSupportInContext = true;
            }
        }
    }
    if( isSelectedObjectSupportInContext ) {
        if( cmm.isInstanceOf( 'ChangeNoticeRevision', vmo.modelType ) ||
            cmm.isInstanceOf( 'Fnd0AbstractMarkupSpace', vmo.modelType ) ) {
            isCreatedObjectSupportInContext = true;
        }
        if( isCreatedObjectSupportInContext ) {
            openInEdit = false;
        }
    }
    if( openInEdit ) {
        showObjectCommandHandler.execute( vmo, null, true );
    }
};

/**
 * Validate data for Change Context Provider
 *
 * @param {Object} data - view model data
 */
export let getChangeContextProvider = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var changeContextToReturn = data.fnd0ContextProvider;
    if( !_reviseEventListener ) {
        _reviseEventListener = eventBus.subscribe( 'reviseObject.assignProjects',
            function( eventData ) {
                if( appCtxSvc.getCtx( 'pselected' ) !== undefined &&
                    appCtxSvc.getCtx( 'pselected' ).modelType &&
                    appCtxSvc.getCtx( 'pselected' ).modelType.typeHierarchyArray.indexOf( 'GnChangeNoticeRevision' ) > -1 &&
                    eventData.scope.data.openNewRevision.dbValue === false ) {
                // This will refresh the Change Summary Table after Revise commmand
                    eventBus.publish( 'resetChangeSummaryTable' );
                }
            } );
    }
    var isLocalChangeContextsuported = exports.isSupportedTCVersionForLocalChangeContext();
    if( !isLocalChangeContextsuported ) {
        changeContextToReturn.dbValue = null;
        changeContextToReturn.dbValues[ 0 ] = null;
        data.fnd0ContextProvider = changeContextToReturn;
        deferred.resolve( changeContextToReturn );
    } else {
        if( appCtxSvc.getCtx( 'pselected' ) === null || appCtxSvc.getCtx( 'pselected' ) === undefined ) {
            changeContextToReturn.dbValue = null;
            changeContextToReturn.dbValues[ 0 ] = null;
            data.fnd0ContextProvider = changeContextToReturn;
            deferred.resolve( changeContextToReturn );
        } else {
            var selectedObject = appCtxSvc.getCtx( 'selected' );
            var changeContextObject = null;
            // We got an Awb0Element as input
            //if awb0Parent property is NULL, means we are revising top most line. In case of top most line there is no local context which can come from parent.
            if( selectedObject.props.awb0UnderlyingObject !== undefined && selectedObject.props.awb0Parent !== undefined && selectedObject.props.awb0Parent.dbValues[ 0 ] !== null ) {
                //Get parent as local change context
                var parentObjectUid = selectedObject.props.awb0Parent.dbValues[ 0 ];
                var parentObject = cdm.getObject( parentObjectUid );
                if( parentObject && parentObject.props.awb0UnderlyingObject !== undefined ) {
                    changeContextObject = cdm.getObject( parentObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                }
                var allObjectUid = [];
                allObjectUid.push( changeContextObject.uid );
                var propToLoad = [ 'cm0AuthoringChangeRevision' ];
                dmSvc.getProperties( allObjectUid, propToLoad ).then(
                    function() {
                        var parentUnderlyingObject = cdm.getObject( parentObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                        var ecnUidFromParentPart = parentUnderlyingObject.props.cm0AuthoringChangeRevision.dbValues[ 0 ];
                        if( ecnUidFromParentPart === '' || ecnUidFromParentPart === null ) {
                            // If No ECN found pass topmost part as local change context
                            changeContextObject = cdm.getObject( appCtxSvc.ctx.aceActiveContext.context.topElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
                        }
                        if( changeContextObject !== null ) {
                            changeContextToReturn.dbValue = changeContextObject;
                            changeContextToReturn.dbValues = changeContextObject;
                            data.fnd0ContextProvider = changeContextToReturn;
                            deferred.resolve( changeContextToReturn );
                        }
                    } );
            }
        }
    }
    return deferred.promise;
};

/**
 * Validate data for Change Context Provider
 *
 * @param {Object} data - view model data
 */
export let getChangeContextProviderForCreate = function( data ) {
    var isLocalChangeContextsuported = exports.isSupportedTCVersionForLocalChangeContext();
    if( !isLocalChangeContextsuported ) {
        data.revision__fnd0ContextProvider.dbValue = null;
        data.revision__fnd0ContextProvider.dbValues = null;
    } else {
        if( appCtxSvc.getCtx( 'selected' ) !== undefined && appCtxSvc.getCtx( 'selected' ) !== null ) {
            var isChangeItemRevision = false;
            if( cmm.isInstanceOf( 'ChangeItemRevision', appCtxSvc.getCtx( 'selected' ).modelType ) ) {
                isChangeItemRevision = true;
            }

            if( isChangeItemRevision && appCtxSvc.getCtx( 'selected' ).props.items_tag !== undefined ) {
                data.revision__fnd0ContextProvider.dbValue = appCtxSvc.getCtx( 'selected' ).props.items_tag.dbValues[ 0 ];
                data.revision__fnd0ContextProvider.dbValues = appCtxSvc.getCtx( 'selected' ).props.items_tag.dbValues[ 0 ];
            }
        }
        //Handle creating content inside structure.
        if( appCtxSvc.getCtx( 'pselected' ) !== undefined &&
            appCtxSvc.getCtx( 'pselected' ).props &&
            appCtxSvc.getCtx( 'pselected' ).props.awb0UnderlyingObject !== undefined &&
            appCtxSvc.ctx.sidenavCommandId !== null && ( appCtxSvc.ctx.sidenavCommandId === 'Awb0AddChildElementDeclarative' ||
                appCtxSvc.ctx.sidenavCommandId === 'Awb0AddSiblingElementDeclarative' ||
                appCtxSvc.ctx.sidenavCommandId === 'Awb0ReplaceElementDeclarative' ) || appCtxSvc.ctx.sidenavCommandId === 'Awb0InsertLevel' ) {
            var selectedObject = appCtxSvc.getCtx( 'selected' );
            var changeContextObjectUid = '';
            if( appCtxSvc.ctx.sidenavCommandId === 'Awb0AddChildElementDeclarative' ) {
                changeContextObjectUid = selectedObject.props.awb0UnderlyingObject.dbValues[ 0 ];
            }
            if( appCtxSvc.ctx.sidenavCommandId === 'Awb0ReplaceElementDeclarative' || appCtxSvc.ctx.sidenavCommandId === 'Awb0AddSiblingElementDeclarative' || appCtxSvc.ctx.sidenavCommandId === 'Awb0InsertLevel' ) {
                var parentObjectUid = selectedObject.props.awb0Parent.dbValues[ 0 ];
                var parentObject = cdm.getObject( parentObjectUid );
                if( parentObject && parentObject.props.awb0UnderlyingObject !== undefined ) {
                    changeContextObjectUid = parentObject.props.awb0UnderlyingObject.dbValues[ 0 ];
                }
            }
            data.revision__fnd0ContextProvider.dbValue = changeContextObjectUid;
            data.revision__fnd0ContextProvider.dbValues = changeContextObjectUid;
        }
    }
};

/**
 * Checks the TC version and returns the boolean for local change context functionality
 * Local change context is supported from Tc11.5.
 *
 * @returns {Boolean} true if TC version is supported for local change context
 */
export let isSupportedTCVersionForLocalChangeContext = function() {
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();
    var qrmNumber = tcSessionData.getTCQRMNumber();
    //Internal name for Tc11.5 is 11.2.6
    if( tcMajor === 11 && tcMinor >= 2 && qrmNumber >= 6 ) {
        return true;
    }
    //For Tc12 and newer releases
    if( tcMajor > 11 ) {
        return true;
    }
    return false;
};

/**
 * Checks the TC version and returns the boolean for in context objects functionality
 * In context objects is supported from Tc12.2.
 *
 * @returns {Boolean} true if TC version is supported for in context objects
 */
export let isSupportedTCVersionForInContextObjects = function() {
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();
    var qrmNumber = tcSessionData.getTCQRMNumber();
    //Internal name for Tc12.2
    if( tcMajor === 12 && tcMinor >= 2 && qrmNumber >= 0 ) {
        return true;
    }
    //For Tc13 and newer releases
    if( tcMajor > 12 ) {
        return true;
    }
    return false;
};

/**
 * set isCreatePinEvent to true  during create / submit change flow. Create/ Submit change triggers primaryWorkArea.selectionChangeEvent which indeed close the panel
 *  To preventing close panel when panel is pinned isCreatePinEvent set to true and checked before panel close
 *
 */
export let setConditionToPin = function( data, subPanelContext ) {
    if( subPanelContext && subPanelContext.panelPinned ) {
        data.isCreatePinEvent = true;
    }
};

/**
 * This function check primaryWorkArea.selectionChangeEvent event occure. If primaryWorkArea.selectionChangeEvent event occure
 * during create/ submit change it will not close the pinned panel else it will call complete to close the panel
 *
 */
export let panelUnpinClose = function( data ) {
    if( appCtxSvc.ctx.CreateChangePanel.selectedObjects !== undefined ) {
        if( data.isCreatePinEvent !== true || appCtxSvc.ctx.CreateChangePanel.selectedObjects.length !== appCtxSvc.ctx.mselected.length ) {
            eventBus.publish( 'change.complete' );
        }
    }
    if( data.isCreatePinEvent !== undefined ) {
        data.isCreatePinEvent = false;
    }
};

/**
 * Remove SymptomDefect .Called when clicked on the remove cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let removeSymptomDefect = function( data ) {
    var allLoadedObjects = data.dataProviders.getSymptomDefectProvider.viewModelCollection.getLoadedViewModelObjects();
    var remainObjects = _.difference( allLoadedObjects, appCtxSvc.ctx.Caw0RemovedDefect );
    data.dataProviders.getSymptomDefectProvider.update( remainObjects, remainObjects.length );
    appCtxSvc.unRegisterCtx( 'Caw0RemovedDefect' );
};

/**
 * Updating getAttachments provider of Attachments section with newly added object
 *
 * @param {Object} data - Data
 * @param {Object} newAttachments - New attachments which needs to be added
 * @return {Boolean} - returns true if new attachments are successfully added to getAttachments provider
 */
export let updateAttachmentsProvider = function( data, newAttachments ) {
    if( data && data.dataProviders && data.dataProviders.getAttachments && newAttachments && newAttachments.length > 0 ) {
        let allResources = data.dataProviders.getAttachments.viewModelCollection.loadedVMObjects;
        _.forEach( newAttachments, function( vmo ) {
            allResources.push( vmo );
        } );

        // Remove the duplicates if present in presetObjects list.
        allResources = _.uniqWith( allResources, function( objA, objB ) {
            return objA.uid === objB.uid;
        } );

        // Update data provider.
        data.dataProviders.getAttachments.update( allResources );

        // Need to remove this code in future, parentData is used in _getInputForCreateOperation
        if( !parentData.attachments ) {
            parentData.attachments = [];
        }
        if( !parentData.attachmentsUids ) {
            parentData.attachmentsUids = [];
        }
        for( let i = 0; i < allResources.length; i++ ) {
            var indexOfAttachment = parentData.attachmentsUids.indexOf( allResources[ i ].uid );
            if( indexOfAttachment === -1 ) {
                parentData.attachments.push( allResources[ i ] );
                parentData.attachmentsUids.push( allResources[ i ].uid );
            }
        }
    }
    return true;
};

/**
 * Updating Atomic data value.
 * @param {Object} AtomicObj - Atomic object
 * @param {Object} value - new value
 */
export const updateChangeAtomicData = function( AtomicObj, value ) {
    if( AtomicObj && AtomicObj.update ) {
        AtomicObj.update( value );
    }
};

export default exports = {
    getData,
    setDefaultSelectedType,
    getCreateInput,
    handleHostedModeIssueTypeCreation,
    handleTypeSelectionJs,
    getTypeSelectedInformation,
    clearSelectedType,
    initializeCreateChangePanel,
    getInputForCreatableChangeType,
    getInputForAssignAndRemoveObjectsSOA,
    processResponseForTypeNames,
    ensureChangeTypesLoadedJs,
    getCreatableChangeTypesProvided,
    getDeriveData,
    updateResponsibleUserDataProvider,
    removeResponsibleUser,
    removeAttachementJs,
    selectCells,
    handleSelectionModel,
    initializeDefaultValues,
    openNewObjectInEditMode,
    getChangeContextProvider,
    getChangeContextProviderForCreate,
    isSupportedTCVersionForLocalChangeContext,
    isSupportedTCVersionForInContextObjects,
    setConditionToPin,
    panelUnpinClose,
    getDeriveOptions,
    removeSymptomDefect,
    updateAttachmentsProvider,
    updateChangeAtomicData
};
