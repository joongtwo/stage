// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ctm1ContentMgmtCreateDitaRelationService
 */
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import messagingSvc from 'js/messagingService';
import occmgmtBackingObjProviderSvc from 'js/occmgmtBackingObjectProviderService';

var exports = {};

var _localizedText = {};


/**
 * This method is used for Add panels to get the Relation Selection list for its data provider.
 * @returns {Array} the LOV return values
 */
export let getDitaRelationList = function() {
    return [ {
            propDisplayValue: _localizedText.composableReference,
            propInternalValue: 'DC_ComposableReferenceR'
        },
        {
            propDisplayValue: _localizedText.topicToTopicReference,
            propInternalValue: 'DC_TopicTopicR'
        }
    ];

};

/**
 * Get Occurrence Search Criteria.
 * @param {Object} ctx the context.
 * @returns  search criteria list.
 */
export let getOccurrenceSearchCriteria = function( ctx ) {
    var searchCriteria = [ {
            "className": "PSOccurrenceType",
            "searchAttributes":
            {
                "name": "DC_ComposableReferenceR"
            }
        }
    ];

    if (ctx.ctm1.hasTopicTopicR === 'true') {
        searchCriteria.push({
            "className": "PSOccurrenceType",
            "searchAttributes":
            {
                "name": "DC_TopicTopicR"
            }
        });
    }

    return searchCriteria;
};

/**
 * Get the uids of DC_ComposableReferenceR and DC_TopicTopicR OccurenceType objects 
 * @param {Objet} response SOA reponase
 * @returns the uids.
 */
 export let getOccurrenceTypes = function (response) {
    var occurrenceTypes = [];

    if (response.result) {
        response.result.forEach(function (obj) {
            var modelObject = cdm.getObject(obj.uid);

            if (modelObject.props.name && modelObject.props.name.dbValues[0] === 'DC_ComposableReferenceR') {
                occurrenceTypes.push({
                    propDisplayValue: _localizedText.composableReference,
                    propInternalValue: obj.uid
                });
            }
            else if (modelObject.props.name && modelObject.props.name.dbValues[0] === 'DC_TopicTopicR') {
                occurrenceTypes.push({
                    propDisplayValue: _localizedText.topicToTopicReference,
                    propInternalValue: obj.uid
                });
            }


        });
    }

    return occurrenceTypes;
};

/**
 * This method is used for Add panels to get the reference topic type list for its data provider.
 * @param {Object} ctx the ctx
 * @param {Object} data the data
 * @returns {Array} the LOV return values
 */
export let getReferenceList = function( ctx, data ) {
    return ctx.ctm1.referenceTopicTypeList;
};

/**
 * This function moves the data fields from Data to Ctx since these variables are used in post processing
 * and cannot be apart of the create.
 * @param {Object} ctx the ctx
 * @param {Object} data the data
 */

export let moveDitaRelationDataToCtx = function( ctx, data ) {
    ctx.referenceListValues = [];
};

/**
 * Initialize topic relation context.
 * @param {Object} ctx the ctx
 */
export let initRelationContext = function( ctx, data ) {
    ctx.ctm1 = {};
    ctx.ctm1.referenceTopicType = data.referenceTopicType;
    ctx.ctm1.ctm0KeyName = data.ctm0KeyName;
    ctx.referenceListValues = [];
};

/**
 * handle relation selection change.
 * @param {Object} ctx the ctx
 * @param {Object} data the view data
 *
 */
export let relationSelectionChange = function( ctx, data ) {
    var relationSeletion = "DC_ComposableReferenceR";
    if ( data.rrr__relationSelection  ) {
        relationSeletion = data.rrr__relationSelection.dbValue;
    }
    else if ( data.relationSelection ) {
        relationSeletion = data.relationSelection.dbValue;
    }
    //TODO updatePartial
    ctx.aceActiveContext.context.addElement.elementCreateInput[0].createData.propertyNameValues.occ_type = [relationSeletion];
};

/**
 * This method returns the input data for the SOA that saves properties back to the database.
 * @param {Object} data the view data
 * @param {Object} ctx the ctx
 * @returns {Object} the SOA inputs
 */
export let buildInputForDitaRelationWorkflow = function( data, ctx ) {
    var inputs = [];
    var modifiedProperties = [];

    var obj = {
        type: 'Ctm1Topic',
        uid: data.addElementResponse.selectedNewElementInfo.newElements[ 0 ].uid
    };

    var modifiedProperty = {
        propertyName: 'iav1OccType',
        dbValues: data.rrr__relationSelection.dbValues,
        uiValues: data.rrr__relationSelection.uiValues,
        intermediateObjectUids: [],
        isModifiable: true
    };

    modifiedProperties.push( modifiedProperty );
    var input = {
        obj: obj,
        viewModelProperties: modifiedProperties,
        isPessimisticLock: false,
        workflowData: {}
    };

    inputs.push( input );
    return inputs;
};

/**
 * This method is used for Add panels to find the valid relation and reference topic type.
 * @param {Object} ctx the ctx
 * @param {Object} topicTypeUid the topicType
 * @param {Object} allowMultiVersions the flag for allowing multi topic type versions.
 * 
 */
export let topicTypeSelectionChange = function( ctx, topicTypeUid, allowMultiVersions ) {
    var lov = [];
    if ( topicTypeUid ) {
        var topicType = cdm.getObject( topicTypeUid );
        for (let x = 0; x < ctx.ctm1.referenceTopicTypeRelationsMap.length; ++x) {
            let obj = ctx.ctm1.referenceTopicTypeRelationsMap[x];

            if (obj.inputObject.props.referenceType.dbValues[0] === 'COMPOSABLE_TOPIC_REFERENCE') {
                for (let y = 0; y < obj.relationshipData[0].relationshipObjects.length; ++y) {
                    let rObj = obj.relationshipData[0].relationshipObjects[y];

                    if ( topicTypeUid === rObj.otherSideObject.uid ||
                        ( allowMultiVersions === 'true' && topicType.props.tagName.dbValues[0] === rObj.otherSideObject.props.tagName.dbValues[0] ) ) {
                        if ( !topicTypesContains( lov, obj.inputObject.props.object_name.uiValues[0] ) ) {
                            var prop = {
                                propDisplayValue: obj.inputObject.props.object_name.uiValues[0],
                                propInternalValue: obj.inputObject.uid,
                                propInternalType: obj.inputObject.type
                            };
                            lov.push(prop);
                        }
                    }
                }
            }
        }

        ctx.ctm1.hasTopicTopicR = "false";
        if ( ctx.ctm1.parentTopicTypeRelations && ctx.ctm1.parentTopicTypeRelations.DC_TopicType ) {
            for (let y = 0; y < ctx.ctm1.parentTopicTypeRelations.DC_TopicType.length; y++ ) {
                let aTopicType = ctx.ctm1.parentTopicTypeRelations.DC_TopicType[y];
                if (topicTypeUid === aTopicType.uid ||
                    ( allowMultiVersions === 'true' && topicType.props.tagName.dbValues[0] === aTopicType.props.tagName.dbValues[0] )) {
                    ctx.ctm1.hasTopicTopicR = "true";
                    break;
                }
            }
        }
    }

    // Return unique lov
    let sortedLOV = Array.from( new Set( lov ) ).sort( function( a, b ) {
        return a.propDisplayValue - b.propDisplayValue;
    } );

    var ctm1Ctx = ctx.ctm1;

    ctm1Ctx.referenceTopicTypeList = sortedLOV;
    appCtxService.updateCtx( 'ctm1', ctm1Ctx );

    ctm1Ctx = appCtxService.getCtx( 'ctm1' );
    return ctm1Ctx.referenceTopicTypeList;
};

/**
 * Check if topic type is included in the topic type list.
 * @param {Object} topicTypeList array of topic types
 * @param {Object} topicTypeName tipic type name
 * @returns true if the topic array contains the given topic, false otherwise.
 */
var topicTypesContains = function( topicTypeList, topicTypeName ) {
    if ( topicTypeList && topicTypeList.length > 0 ) {
        for ( let i = 0; i < topicTypeList.length; i++ ) {
            if ( topicTypeList[i].propDisplayValue ===  topicTypeName ) {
                return true;
            }
        }
    }

    return false;
};


/**
 * Get topic type of selected objectin palette tab if selected object is dita topic or publication.
 * @param {Object} ctx context object.
 * @returns topic type if only one object is selected and the selected object is dita topic or publication.
 */
export let handlePaletteSelection = function( ctx ) {
    var paletteSelection = [];
    if (ctx.aceActiveContext.context.addElement.selectedTab.panelId === "paletteTabPageSub") {

        if (ctx.getClipboardProvider && ctx.getClipboardProvider.selectedObjects.length > 0) {
            paletteSelection.push.apply(paletteSelection, ctx.getClipboardProvider.selectedObjects);
        }
        if (ctx.getFavoriteProvider && ctx.getFavoriteProvider.selectedObjects.length > 0) {
            paletteSelection.push.apply(paletteSelection, ctx.getFavoriteProvider.selectedObjects);
        }
        if (ctx.getRecentObjsProvider && ctx.getRecentObjsProvider.selectedObjects.length > 0) {
            paletteSelection.push.apply(paletteSelection, ctx.getRecentObjsProvider.selectedObjects);
        }
    }

    if (paletteSelection.length === 1 && (paletteSelection[0].modelType.typeHierarchyArray.indexOf('DC_DitaAbsMapRevision') > -1 ||
        paletteSelection[0].modelType.typeHierarchyArray.indexOf('DC_DitaAbsTopicRevision') > -1 ||
        paletteSelection[0].modelType.typeHierarchyArray.indexOf('DC_PublicationRevision') > -1)) {

        let topicTypeUid = paletteSelection[0].props.ctm0TopicTypeTagref.dbValues[0];
        var modelObject = cdm.getObject( topicTypeUid );
        ctx.ctm1.selectedTopic = modelObject;
    }
    else {
        ctx.ctm1.selectedTopic = null;
    }

};

/**
 * Update relation selection enablement.
 * @param {object} data context
 */
export let updateRelationSelectionEnablement = function( data ) {
    let ctm1Ctx = appCtxService.getCtx( 'ctm1' );
    if( data.rrr__relationSelection ) {
        if ( ctm1Ctx.hasTopicTopicR === "false" ){
            data.rrr__relationSelection.dbValue = "DC_ComposableReferenceR";
            data.rrr__relationSelection.isEnabled = false;
        }
        else if ( data.rrr__relationSelection.isEnabled === false ) {
            data.rrr__relationSelection.isEnabled = true;
        }
    }

};

/**
 * Create RefTopicType Relation
 * @param {Object} referenceTopicTypeeUid refTopicType Uid
 * @param {StriObjectng} keyName key name
 * @param {Object} data view data
 */
export let createRefTopicTypeRelation = function( referenceTopicTypeeUid, keyName, data ) {
    occmgmtBackingObjProviderSvc.getBackingObjects(data.eventData.addElementResponse.selectedNewElementInfo.newElements).then(function (bomLines) {
        let inputData =  {
            "input" :[ {
            "clientId": "add reftopictype relation",
            "composableBO": bomLines[0],
            "revisionRule": null,
            "keyValueArgs": {
                "actionType": "add_reftopictype_relation",
                "reftopictype_uid": referenceTopicTypeeUid,
                "ctm0KeyName": keyName
            }
        } ]};

        soaSvc.post( 'ContMgmtBase-2011-06-ContentManagement', 'composeContent', inputData ).then( function (response){
            var error = null;
            if( response.ServiceData && response.ServiceData.partialErrors ) {
                error = soaSvc.createError( response.ServiceData );
            }

            if( error ) {
                var errMessage = messagingSvc.getSOAErrorMessage( error );
                messagingSvc.showError( errMessage );
                return AwPromiseService.instance.reject( error );
            }
        });
    });
};

var loadConfiguration = function() {
    localeSvc.getTextPromise( 'ContentMgmtMessages', true ).then(
        function( localTextBundle ) {
            _localizedText = localTextBundle;
        } );

    var aceContext = appCtxService.getCtx( 'aceActiveContext');
    if ( aceContext ) {
        appCtxService.updatePartialCtx( aceContext.key + '.occmgmtElementPropPanel', 'Ctm1TopicTopicRelation' );
    }

    eventBus.subscribe('occDataLoadedEvent', function (eventData) {
        if (eventData && eventData.contextKey) {
            appCtxService.updatePartialCtx(eventData.contextKey + '.occmgmtElementPropPanel', 'Ctm1TopicTopicRelation');
        }
    });
    
};

loadConfiguration();

/**
 * Ctm1ContentMgmtCreateTopicTypeService factory
 */

export default exports = {
    getDitaRelationList,
    getReferenceList,
    moveDitaRelationDataToCtx,
    getOccurrenceSearchCriteria,
    getOccurrenceTypes,
    handlePaletteSelection,
    buildInputForDitaRelationWorkflow,
    initRelationContext,
    relationSelectionChange,
    createRefTopicTypeRelation,
    topicTypeSelectionChange,
    updateRelationSelectionEnablement
};
