// Copyright (c) 2022 Siemens

/**
 * @module js/swiService
 */
import appCtxSvc from 'js/appCtxService';
import navigationSvc from 'js/navigationService';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import awMessageService from 'js/messagingService';
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
let exports = {};
const delimiter = ", ";
const spaceDelimiter = " ";
const hyphenDelimiter = "-";    
const bracketOpen = "(";
const bracketClose = ")";

export let registerUidAndNavigate = function (vmo) {
    var objUid;
    var navigationParams = {};
    var action = {
        actionType: 'Navigate',
        navigateTo: 'swi'
    };
    objUid = vmo.uid;
    initializeSwiContext(objUid);
    navigationParams.uid = objUid;
    navigationSvc.navigate(action, navigationParams);
};

export let initialize = function () {
    let swiContext = appCtxSvc.getCtx('swiContext');
    if (swiContext) {
        return swiContext;
    }
    let params = appCtxSvc.getCtx('state.params');
    initializeSwiContext(params.uid);
    return cdm.getObject(params.uid);
};

let initializeSwiContext = async function (objUid) {
    let swiContext = cdm.getObject(objUid);
    swiContext.objectName = swiContext.props.object_name ? swiContext.props.object_name.dbValues[0] : swiContext.props.bl_item_object_name.dbValues[0];
    appCtxSvc.updateCtx('swiContext', swiContext);
};

export let setNextPreviousCondition = function (swiAtomicData) {
    let nextPreviousFlag = {};
    nextPreviousFlag.isNext = swiAtomicData.selected.isNext;
    nextPreviousFlag.isPrevious = swiAtomicData.selected.isPrevious;
    return nextPreviousFlag;
};

export let getNavigateInput = function (inputData) {
    return inputData.vmo ? inputData.vmo : appCtxSvc.getCtx('selectedVMO');
};

export let setVisiblity = function (data) {
    let cloneData = data;
    cloneData.isPanelVisible = data.isPanelVisible ? false : true;
    cloneData.defaultDownArrowVisible = data.defaultDownArrowVisible ? false : true;
    return cloneData;
};

export let showPartialErrors = function (response) {
    let err;
    if (response.partialErrors || response.PartialErrors || response.ServiceData && response.ServiceData.partialErrors) {
        if (response.ServiceData && response.ServiceData.partialErrors) {
            err = soaSvc.createError(response.ServiceData);
        } else {
            err = soaSvc.createError(response);
        }
        let errMessage = awMessageService.getSOAErrorMessage(err);
        awMessageService.showError(errMessage);
    }
};

export let processRelatedObjects = async function (relatedObjects,partApplicabilityToolTipKey) {
    let outputData={};
    let faultCodeString = "";
    let frequencyExpString = "";
    let requiresString = "";
    let requiredByString = "";
    let satisfiesString = "";
    let satisfiedByString = "";
    var partApplicabilityString = "";
    let serviceReqDescriptionValue = "";
   let partApplicabilityToolTip = "";
    let swiContext = cdm.getObject(appCtxSvc.getCtx('swiContext').uid);
    if (swiContext.modelType.typeHierarchyArray.indexOf("SSP0ServiceReq") > -1 || swiContext.modelType.typeHierarchyArray.indexOf("SSP0BvrServiceRequirement") > -1) {
        serviceReqDescriptionValue = swiContext.props.object_desc ? swiContext.props.object_desc.dbValues[0] : swiContext.props.bl_item_object_desc.dbValues[0];
    }
    else {
            let serviceReqItem = cdm.getObject(swiContext.props.items_tag.dbValues[0]);
            serviceReqDescriptionValue = serviceReqItem.props.object_desc.dbValues[0];
    }
    if (relatedObjects.FaultCode.length >= 1) {
        let faultCodes = relatedObjects.FaultCode;
        for (let i = 0; i < faultCodes.length; i++) {
            let faultCodeName = cdm.getObject(faultCodes[i].uid).props.object_name.dbValues[0];
            if (i === faultCodes.length - 1) {
                faultCodeString = faultCodeString + faultCodeName;
            }
            else {
                faultCodeString = faultCodeString + faultCodeName + delimiter;
            }
        }
    }
    if (relatedObjects.Frequency.length >= 1) {
        let frequency = relatedObjects.Frequency;
        for (let i = 0; i < frequency.length; i++) {
            let frequencyExp = cdm.getObject(frequency[i].uid).props.ssp0FrequencyExpression.dbValues[0];
            if (i === frequency.length - 1) {
                frequencyExpString = frequencyExpString + frequencyExp;
            }
            else {
                frequencyExpString = frequencyExpString + frequencyExp + delimiter;
            }
        }
    }
    if (relatedObjects.Requires.length >= 1) {
        let requires = relatedObjects.Requires;
        for (let i = 0; i < requires.length; i++) {
            let requiresObjString = cdm.getObject(requires[i].uid).props.object_string.dbValues[0];
            if (i === requires.length - 1) {
                requiresString = requiresString + requiresObjString;
            }
            else {
                requiresString = requiresString + requiresObjString + delimiter;
            }
        }

    }
    if (relatedObjects.RequiredBy.length >= 1) {
        let requiredBy = relatedObjects.RequiredBy;
        for (let i = 0; i < requiredBy.length; i++) {
            let requiredByObjString = cdm.getObject(requiredBy[i].uid).props.object_string.dbValues[0];
            if (i === requiredBy.length - 1) {
                requiredByString = requiredByString + requiredByObjString;
            }
            else {
                requiredByString = requiredByString + requiredByObjString + delimiter;
            }
        }

    }
    if (relatedObjects.Satisfies.length >= 1) {
        let satisfies = relatedObjects.Satisfies;
        for (let i = 0; i < satisfies.length; i++) {
            let satisfiesObjString = cdm.getObject(satisfies[i].uid).props.object_string.dbValues[0];
            if (i === satisfies.length - 1) {
                satisfiesString = satisfiesString + satisfiesObjString;
            }
            else {
                satisfiesString = satisfiesString + satisfiesObjString + delimiter;
            }
        }

    }
    if (relatedObjects.SatisfiedBy.length >= 1) {
        let satisfiedBy = relatedObjects.SatisfiedBy;
        for (let i = 0; i < satisfiedBy.length; i++) {
            let satisfiedByObjString = cdm.getObject(satisfiedBy[i].uid).props.object_string.dbValues[0];
            if (i === satisfiedBy.length - 1) {
                satisfiedByString = satisfiedByString + satisfiedByObjString;
            }
            else {
                satisfiedByString = satisfiedByString + satisfiedByObjString + delimiter;
            }
        }

    }
    if (relatedObjects.PartApplicability.length >= 1) {
        partApplicabilityString = await getPartAppString(partApplicabilityString);
        
        partApplicabilityToolTip = partApplicabilityToolTipKey+partApplicabilityString;
    }

    return outputData = {
        faultCodeString: faultCodeString,
        frequencyExpString: frequencyExpString,
        requiresString: requiresString,
        requiredByString: requiredByString,
        satisfiesString: satisfiesString,
        satisfiedByString: satisfiedByString,
        serviceReqDescriptionValue: serviceReqDescriptionValue,
        partApplicabilityString: partApplicabilityString,
        partApplicabilityToolTip: partApplicabilityToolTip
    };
};

var getPartAppString = function async (partApplicabilityString) {

    let swiContext = appCtxSvc.getCtx('swiContext');
    let srItem;

    if (swiContext.modelType.typeHierarchyArray.indexOf("SSP0ServiceReq") > -1) {
        srItem = swiContext;
    }
    else if (swiContext.modelType.typeHierarchyArray.indexOf("SSP0ServiceReqRevision") > -1) {
        srItem = cdm.getObject(swiContext.props.items_tag.dbValues[0]);

    }
    else if (swiContext.modelType.typeHierarchyArray.indexOf("SSP0BvrServiceRequirement") > -1) {

        srItem = cdm.getObject(swiContext.props.bl_item.dbValues[0]);
    }
    const expandGRMForPrimaryInput = {
        primaryObjects: [srItem],
        pref: {
            expItemRev: false,
            returnRelations: true,
            info: [{
                relationTypeName: 'SSP0PartApplicability',
                otherSideObjectTypes: []
            }]
        }
    };
    const policy = {
        types: [{
            name: 'SSP0PartApplicability',
            properties: [{
                name: 'ssp0PartApplicabilityData',
                modifiers: [{
                    name: "withProperties",
                    Value: "true"
                }]
            }]
        },
        {
            name: 'SSP0PartApplicabilityData',
            properties: [{
                name: 'ssp0EndSerialNumber'
            },
            {
                name: 'ssp0StartSerialNumber'
            }]
        }]
    };
    var policyId = policySvc.register(policy);
    return soaService.postUnchecked('Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', expandGRMForPrimaryInput).then((response) => {
        if (policyId) {
            policySvc.unregister(policyId);
        }
        let relationshipData = response.output[0].relationshipData[0].relationshipObjects;
        for (let i = 0; i < relationshipData.length; i++) {
            let otherSideObj = relationshipData[i].otherSideObject;
            let partObjString = otherSideObj.props.object_string.dbValues[0];
            let partAppData = relationshipData[i].relation.props.ssp0PartApplicabilityData.dbValues;
            partApplicabilityString = partApplicabilityString + partObjString;
            for (let index = 0; index < partAppData.length; index++) {
                let partAppDataObj = cdm.getObject(partAppData[index]);
                let serialNosString = "";
                if (partAppDataObj.props.ssp0StartSerialNumber.dbValues[0] !== null || partAppDataObj.props.ssp0EndSerialNumber.dbValues[0] !== null) {
                    let partAppDataSerialStart = partAppDataObj.props.ssp0StartSerialNumber.dbValues[0];
                    let partAppDataSerialEnd = partAppDataObj.props.ssp0EndSerialNumber.dbValues[0];
                    serialNosString =bracketOpen+ partAppDataSerialStart + hyphenDelimiter + partAppDataSerialEnd +bracketClose;
                    partApplicabilityString = partApplicabilityString + spaceDelimiter +serialNosString;
                }
            }
            if (i < relationshipData.length -1) {
            partApplicabilityString = partApplicabilityString + delimiter;
            }
            
        }
        return partApplicabilityString;
    });

};
export default exports = {
    registerUidAndNavigate,
    initialize,
    setNextPreviousCondition,
    getNavigateInput,
    setVisiblity,
    showPartialErrors,
    processRelatedObjects
};
