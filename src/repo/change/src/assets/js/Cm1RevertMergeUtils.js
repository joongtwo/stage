// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Cm1RevertMergeUtils
 */
import appCtxService from 'js/appCtxService';
import dmSvc from 'soa/dataManagementService';
import localeSvc from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import occurrenceManagementServiceManager from 'js/occurrenceManagementServiceManager';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';

var exports = {};
let _contentUnloadedListener = null;

export let getInputForRevert = function(  ) {
    let inputs = [];
    let selectedVmo =  appCtxService.ctx.selected;

    // If selection is from ACE
    if( selectedVmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        for( var selCount = 0; selCount < appCtxService.ctx.mselected.length; selCount++ ) {
            let input = {
                selectedBOMLine: appCtxService.ctx.mselected[ selCount ].uid,
                selectedObject:  'AAAAAAAAAAAAAA',
                propertiesToRevert: [],
                secondarySelections : [],
                revertChildren : false
            };
            inputs.push( input );
        }
    } else {   // If selection is from secondary work area like object-set table
        var parentSelectionUid = '';
        var parentSelection  = appCtxService.ctx.pselected;
        if( parentSelection.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            parentSelection = parentSelection.props.awb0UnderlyingObject;
            parentSelectionUid = parentSelection.dbValues[0];
        } else {
            parentSelectionUid = parentSelection.uid;
        }

        let secSelections = [];
        let relationName = '';
        if( appCtxService.ctx.relationContext && appCtxService.ctx.relationContext.relationInfo && appCtxService.ctx.relationContext.relationInfo.length > 0 ) {
            relationName = appCtxService.ctx.relationContext.relationInfo[0].relationType;
            for( var selCount = 0; selCount < appCtxService.ctx.relationContext.relationInfo.length; selCount++ ) {
                if( parentSelectionUid === appCtxService.ctx.relationContext.relationInfo[ selCount ].secondaryObject.uid ) { //handle S2P
                    secSelections.push( appCtxService.ctx.relationContext.relationInfo[ selCount ].primaryObject.uid );
                } else{
                    secSelections.push( appCtxService.ctx.relationContext.relationInfo[ selCount ].secondaryObject.uid );
                }
            }
        }

        var input  = {
            selectedBOMLine: 'AAAAAAAAAAAAAA',
            selectedObject:  parentSelectionUid,
            propertiesToRevert: [ relationName ],
            secondarySelections : secSelections,
            revertChildren : false
        };

        inputs.push( input );
    }

    return inputs;
};

export let createWarningParameterForRevert = function(  ) {
    let selectedObjects = [];
    let selectedVmo =  appCtxService.ctx.selected;
    if( selectedVmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        for( var selCount = 0; selCount < appCtxService.ctx.mselected.length; selCount++ ) {
            selectedObjects.push( appCtxService.ctx.mselected[ selCount ] );
        }
    } else {
        selectedObjects.push( appCtxService.ctx.pselected );
    }

    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    var hasAdd = false;
    var hasRemove = false;
    var hasUpdate = false;
    var hasAttachement = false;
    var hasRevise = false;
    let warningText = '';
    if( selectedObjects && selectedObjects.length > 0 ) {
        for( var s = 0; s < selectedObjects.length; s++ ) {
            warningText += selectedObjects[ s ].props.object_string.uiValues[ 0 ];

            if( selectedVmo.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                let isReplaced = false;
                let isRevise = false;
                let updatedPropNames = selectedObjects[ s ].props.awb0MarkupPropertyNames.dbValues;
                if( updatedPropNames && updatedPropNames.length > 0 ) {
                    for( var p = 0; p < updatedPropNames.length; p++ ) {
                        if( updatedPropNames[ p ] === 'awb0ArchetypeId' ) {
                            isReplaced = true;
                            break;
                        }
                    }
                    if( !isReplaced ) {
                        for( var p = 0; p < updatedPropNames.length; p++ ) {
                            if( updatedPropNames[ p ] === 'awb0ArchetypeRevId' ) {
                                isRevise = true;
                                break;
                            }
                        }
                    }
                }
                let actionName = '';
                let markupType = selectedObjects[ s ].props.awb0MarkupType.dbValues[ 0 ];
                if( markupType === '128' ) { // Added line
                    actionName = localTextBundle.Cm1AddText;
                    hasAdd = true;
                }
                if( markupType === '144' ) { // Added with absolute occ property change line
                    actionName = localTextBundle.Cm1AddText;
                    hasAdd = true;
                }
                if( markupType === '2' ) { // Removed line
                    actionName = localTextBundle.Cm1RemoveText;
                    hasRemove = true;
                }
                if( markupType === '16' ) { // Property Change
                    if( isReplaced ) {
                        actionName = localTextBundle.Cm1ReplaceText; // If ID is different it's Replace Line
                    } else {
                        actionName = localTextBundle.Cm1PropertyChangeText;
                    }
                    hasUpdate = true;
                }

                if( isRevise ) {
                    actionName = 'Revise';
                    hasRevise = true;
                }

                warningText += ' - ' + actionName;
                warningText += '\n';
            } else {
                warningText += ' - ' + localTextBundle.Cm1AttachementText; // Revert from Object Set table
                warningText += '\n';
                hasAttachement = true;
            }
        }
    }

    return {
        revertErrorText : warningText,
        hasAddRevertOperation : hasAdd,
        hasRemoveRevertOperation : hasRemove,
        hasUpdateRevertOperation : hasUpdate,
        hasAttachementRevertOperation : hasAttachement,
        hasReviseOperation : hasRevise

    };
};

/**
 * This function is to get input for merge operation
 *
 * * @returns input required for merge soa
 */
export let getInputForMerge = function( mergeCandidates ) {
    let selectedSourceLines = [];

    if( mergeCandidates !== undefined ) {
        //This is required when Merge All button is clicked
        if( mergeCandidates.length > 0 ) {
            for( var count = 0; count < mergeCandidates.length; count++ ) {
                let mergeCandidate = mergeCandidates[count];
                if( mergeCandidate.isAlreadyMerged === false ) {
                    selectedSourceLines.push( mergeCandidate.objectToBeMerged.uid );
                }
            }
        } else //This is required when only Merge button is clicked
        {
            //Get the selected source lines
            let sourceLineUid = mergeCandidates.mergeCandidateItem.objectToBeMerged.uid;
            selectedSourceLines.push( sourceLineUid );
        }
    } else //This is required when Merge is command is clicked from split view
    {
        //Get the selected source lines
        for( var selCount = 0; selCount < appCtxService.ctx.mselected.length; selCount++ ) {
            let sourceLineUid = appCtxService.ctx.mselected[ selCount ].uid;
            selectedSourceLines.push( sourceLineUid );
        }
    }

    //Populate input for SOA
    return {
        sourceLines: selectedSourceLines,
        targetLine:  appCtxService.ctx.occmgmtContext2.modelObject.uid,
        propertiesToMerge: [],
        mergeChildren : false
    };
};

/**
 * Load Merge data before page launch
 *
 * @returns {Promise} Promise after data load is done
 */
export let loadMergeData = function( params ) {
    let defer = AwPromiseService.instance.defer();

    appCtxService.ctx.taskUI = {};

    localeSvc.getLocalizedText( 'ChangeMessages', 'Cm1MergeViewTitle' ).then( function( result ) {
        appCtxService.ctx.taskUI.moduleTitle = result;
    } );

    localeSvc.getLocalizedText( 'ChangeMessages', 'Cm1MergeViewTitle' ).then( function( result ) {
        appCtxService.ctx.taskUI.taskTitle = result;
    } );

    appCtxService.updatePartialCtx( 'splitView.mode', true );
    appCtxService.updatePartialCtx( 'splitView.viewKeys', [ 'occmgmtContext', 'occmgmtContext2' ] );

    appCtxService.ctx.skipAutoBookmark = true;
    appCtxService.ctx.hideRightWall = true;
    _registerListeners();
};

/**
 * Unregister listeners
 */
let _unRegisterListeners = function() {
    if( _contentUnloadedListener ) {
        eventBus.unsubscribe( _contentUnloadedListener );
        _contentUnloadedListener = null;
    }
};


/**
 * Register listeners
 */
let _registerListeners = function() {
    // Register Page Unload listener
    if( !_contentUnloadedListener ) {
        _contentUnloadedListener = eventBus.subscribe( 'Cm1MergeChanges.contentUnloaded', _cleanupMergeChangesariableFromCtx, 'Cm1RevertMergeUtils' );
    }
};

/**
 * Register properties and call merge candidates soa
 */
export let callGetMergeCandidatesSoa = function( data ) {
    var policy = {
        types: [ {
            name: 'BOMLine',
            properties: [
                {
                    name: 'bl_revision'
                },
                {
                    name: 'bl_rev_item_id'
                },
                {
                    name: 'bl_rev_item_revision_id'
                }
            ]
        } ]
    };

    //Register Policy
    var policyId = propPolicySvc.register( policy );

    //Soa input
    var soaInput = {
        sourceObject: {
            uid:appCtxService.ctx.state.params.uid,
            type:'ItemRevision'
        },
        targetObject: {
            uid:appCtxService.ctx.state.params.uid2,
            type:'ItemRevision'
        }
    };
    // Call SOA to get merge candidates
    return soaSvc.post( 'Internal-CmAws-2022-12-Changes', 'getMergeCandidates', soaInput ).then(
        function( response ) {
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            var mergeCandidates = response.mergeCandidates;
            return updateMergeCandidateProvider( mergeCandidates, data );
        } );
};

/**
 * Update merge candidate provider when split view is launched
 *
 */
export let updateMergeCandidateProvider = function( mergeCandidates, data ) {
    let showMergeAllButton = false;
    if( mergeCandidates.length > 0 ) {
        if( data.dataProviders && data.dataProviders.mergeCandidatesDataProvider ) {
            var candidates = [];
            for( var count = 0; count < mergeCandidates.length; count++ ) {
                var mergeCandidate = mergeCandidates[count];
                var mergeObject = mergeCandidate.objectToBeMerged;
                var id = mergeObject.props.bl_rev_item_id.uiValues[0];
                var revisionId = mergeObject.props.bl_rev_item_revision_id.uiValues[0];
                var objectToBeMergedVmo = viewModelObjectService.createViewModelObject( mergeCandidate.objectToBeMerged.uid );
                objectToBeMergedVmo.cellHeader2 = id;
                objectToBeMergedVmo.cellProperties = {
                    Revision : {
                        key : 'Revision',
                        value : revisionId
                    }
                };
                var canditate = {
                    isAlreadyMerged : mergeCandidate.isAlreadyMerged,
                    objectToBeMerged : objectToBeMergedVmo,
                    mergeAction : {
                        internalName : mergeCandidate.mergeRelatedData.mergeAction[0],
                        displayName : mergeCandidate.mergeRelatedData.mergeAction[1]
                    }
                };
                //Enable MergeAll button if "isAlreadyMerged" property is enabled for any mergeCandidate.
                showMergeAllButton = !showMergeAllButton ? !canditate.isAlreadyMerged : showMergeAllButton;
                candidates.push( canditate );
            }
            data.dataProviders.mergeCandidatesDataProvider.update( candidates,
                candidates.length );
        }
    }
    return {
        showMergeAllButton: showMergeAllButton
    };
};


/**
 * Clean up ACE context
 */
let _cleanupMergeChangesariableFromCtx = function() {
    appCtxService.unRegisterCtx( 'modelObjectsToOpen' );
    let mergeViewKeys = appCtxService.getCtx( 'splitView.viewKeys' );
    _.forEach( mergeViewKeys, function( mergeViewKey ) {
        appCtxService.unRegisterCtx( mergeViewKey );
    } );
    appCtxService.unRegisterCtx( 'splitView' );
    appCtxService.unRegisterCtx( 'taskUI' );
    appCtxService.unRegisterCtx( 'mergeChangesCtx' );
    appCtxService.unRegisterCtx( 'aceActiveContext' );
    appCtxService.updateCtx( 'hideRightWall', undefined );
    _unRegisterListeners();
    occurrenceManagementServiceManager.destroyOccMgmtServices();
};

/**
 * Unregister Ctx after merge location closed/Unmount
 */
let destroyCtxForMergeLocation = function() {
    appCtxService.unRegisterCtx( 'taskbarfullscreen' );
};


/**
 * Revert redline utility functions
 * @param {appCtxService} appCtxService - Service to use
 * @param {localeSvc} occmgmtUtils - Service to use
 */

export default exports = {
    createWarningParameterForRevert,
    getInputForRevert,
    getInputForMerge,
    loadMergeData,
    callGetMergeCandidatesSoa,
    updateMergeCandidateProvider,
    destroyCtxForMergeLocation
};
