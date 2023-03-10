// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtGetOccsResponseService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import messagingService from 'js/messagingService';
import occmgmtUtils from 'js/occmgmtUtils';
import occurrenceManagementStateHandler from 'js/occurrenceManagementStateHandler';
import acePartialSelectionService from 'js/acePartialSelectionService';
import _ from 'lodash';

var exports = {};

var updatePCIInMap = function (occUID, pciUID, context) {
    context = context ? context : appCtxService.ctx.aceActiveContext.context;
    if (pciUID && cdm.isValidObjectUid(pciUID)) {
        if (occUID && cdm.isValidObjectUid(occUID) &&
            context.elementToPCIMap[occUID]) {
            context.elementToPCIMap[occUID] = pciUID;
        } else {
            //Look for the product entry in PCI map and update the same
            let pciObject = cdm.getObject(pciUID);
            let productUID = pciObject.props.awb0Product.dbValues[0];

            for (let key in context.elementToPCIMap) {
                if (context.elementToPCIMap.hasOwnProperty(key)) {
                    let pciModelObject = cdm
                        .getObject(context.elementToPCIMap[key]);
                    if (productUID === pciModelObject.props.awb0Product.dbValues[0]) {
                        context.elementToPCIMap[key] = pciUID;
                        break;
                    }
                }
            }
        }
    }
};

/**
 * This method builds/updates and returns an element to PCI map based on given response. If given response has
 * an element to PCI map then it build a new one from it and returns that. If that is not available but an
 * element to PCI map exists on the occmgmt context then it updates that with the new parent information
 * received in the response and returns it.
 *
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 * @return The updated element to PCI map
 */
export let updateElementToPCIMap = function (response, contextState) {
    let elementToPCIMap;
    let context = contextState ? contextState.context : appCtxService.ctx.aceActiveContext.context;

    if (response.elementToPCIMap) {
        elementToPCIMap = {};
        for (let indx = 0; indx < response.elementToPCIMap[0].length; indx++) {
            let key = response.elementToPCIMap[0][indx].uid;
            let value = response.elementToPCIMap[1][indx].uid;
            elementToPCIMap[key] = value;
        }
    } else if (context.elementToPCIMap) {
        let occUID = response.focusChildOccurrence.occurrenceId;
        let pciUID = response.focusProductContext.uid;
        updatePCIInMap(occUID, pciUID, context);
        occUID = response.parentOccurrence.occurrenceId;
        pciUID = response.parentProductContext.uid;
        updatePCIInMap(occUID, pciUID, context);
        elementToPCIMap = context.elementToPCIMap;
    }

    if (elementToPCIMap) {
        context.elementToPCIMapCount = Object.keys(elementToPCIMap).length;
    }
    return elementToPCIMap;
};

var _populateDisplayToggleOptions = function (displayToggleOptions, response, occContext) {
    let PSEShowUnconfigdEffPref = !_.isUndefined(response.requestPref.PSEShowUnconfigdEffPref) ? response.requestPref.PSEShowUnconfigdEffPref[0] : occContext.displayToggleOptions
        .PSEShowUnconfigdEffPref;
    let PSEShowUnconfigdVarPref = !_.isUndefined(response.requestPref.PSEShowUnconfigdVarPref) ? response.requestPref.PSEShowUnconfigdVarPref[0] : occContext.displayToggleOptions
        .PSEShowUnconfigdVarPref;
    let PSEShowSuppressedOccsPref = !_.isUndefined(response.requestPref.PSEShowSuppressedOccsPref) ? response.requestPref.PSEShowSuppressedOccsPref[0] : occContext.displayToggleOptions
        .PSEShowSuppressedOccsPref;

    if (!_.isUndefined(PSEShowUnconfigdEffPref)) {
        displayToggleOptions.PSEShowUnconfigdEffPref = PSEShowUnconfigdEffPref === 'true' || PSEShowUnconfigdEffPref === true;
    }

    if (!_.isUndefined(PSEShowUnconfigdVarPref)) {
        displayToggleOptions.PSEShowUnconfigdVarPref = PSEShowUnconfigdVarPref === 'true' || PSEShowUnconfigdVarPref === true;
    }

    if (!_.isUndefined(PSEShowSuppressedOccsPref)) {
        displayToggleOptions.PSEShowSuppressedOccsPref = PSEShowSuppressedOccsPref === 'true' || PSEShowSuppressedOccsPref === true;
    }
};

/**
 * @param {Object} TreeLoadOutput - The modelObject to access.
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 */
export let populateRequestPrefInfoOnOccmgmtContext = function (treeLoadOutput, response, occContext) {
    /**
     * Populate the decision for objectQuota loading from the requestPref
     */
    treeLoadOutput.useObjectQuotatoUnload = false;
    if (response.requestPref && response.requestPref.UseObjectQuotatoUnload) {
        if (response.requestPref.UseObjectQuotatoUnload[0] === 'true') {
            treeLoadOutput.useObjectQuotatoUnload = true;
        }
    }

    if (!_.isUndefined(response.requestPref) && treeLoadOutput.supportedFeatures.Awb0DisplayToggleFeature === true) {
        _populateDisplayToggleOptions(treeLoadOutput.displayToggleOptions, response, occContext);
    }
    treeLoadOutput.serializedRevRule = undefined;
    if (response.requestPref && response.requestPref.serializedRevRuleString && !_.isEmpty(response.requestPref.serializedRevRuleString[0])) {
        treeLoadOutput.serializedRevRule = response.requestPref.serializedRevRuleString[0];
    }

    if (response.requestPref && response.requestPref.deltaTreeResponse) {
        treeLoadOutput.deltaTreeResponse = response.requestPref.deltaTreeResponse[0].toLowerCase() === 'true';
    }
};

/**
 * This method Populates the Panel-Id for Add Child/Sibling Panel based on the revOcc feature
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 * @param {ISOAResponse} contextKey - The current context
 */
export let populateFeaturesInfoOnOccmgmtContext = function (treeLoadResult, response, contextKey) {
    var supportedFeatureList = occurrenceManagementStateHandler.getSupportedFeaturesFromPCI(response.rootProductContext);
    var childPanelId = '';
    var siblingPanelId = '';
    if (supportedFeatureList.Awb0RevisibleOccurrenceFeature === true) {
        treeLoadResult.AceHeaderForApplication = 'EcnHeaderMessageOnUsageBom';
    }

    // If the feature list for any PCI object contains stale tree feature key, then show a warning banner with a message.
    if (treeLoadResult.elementToPCIMap) {
        for (let eachElement in treeLoadResult.elementToPCIMap) {
            var pciModelObj = cdm.getObject(treeLoadResult.elementToPCIMap[eachElement]);
            if (occurrenceManagementStateHandler.getSupportedFeaturesFromPCI(pciModelObj).Awb0StaleTreeContent === true) {
                treeLoadResult.AceHeaderForApplication = 'Awb0StaleTreeGuidance';
                break;
            }
        }
    }

    appCtxService.ctx[contextKey].childPanelId = childPanelId;
    appCtxService.ctx[contextKey].siblingPanelId = siblingPanelId;
    if (supportedFeatureList.Awb0ChangeFeature === true) {
        if (_.isUndefined(appCtxService.ctx[contextKey].isChangeEnabled)) {
            var productContextInfo = cdm.getObject(response.rootProductContext.uid);
            if (productContextInfo && productContextInfo.props.awb0ShowChange && productContextInfo.props.awb0ShowChange.dbValues) {
                treeLoadResult.isChangeEnabled = productContextInfo.props.awb0ShowChange.dbValues[0] === '1';
                treeLoadResult.isRedLineMode = treeLoadResult.isChangeEnabled.toString();
            }
        } else {
            treeLoadResult.isChangeEnabled = appCtxService.ctx[contextKey].isChangeEnabled;
            treeLoadResult.isRedLineMode = _.isUndefined(treeLoadResult.isChangeEnabled) ? treeLoadResult.isChangeEnabled : treeLoadResult.isChangeEnabled.toString();
        }
    }
};

/**
 * @param {TreeLoadResult} treeLoadResult - The modelObject to access.
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 */
export let populateSourceContextToInfoMapOnOccmgmtContext = function (treeLoadResult, response, contextKey) {
    var context = appCtxService.getCtx(contextKey);

    if (response.sourceContextToInfoMap) {
        treeLoadResult.sourceContextToInfoMap = {};
        for (var indx = 0; indx < response.sourceContextToInfoMap[0].length; indx++) {
            var key = response.sourceContextToInfoMap[0][indx].uid;
            var baselineInfo = response.sourceContextToInfoMap[1][indx];
            treeLoadResult.sourceContextToInfoMap[key] = baselineInfo;
        }
    }
};

var getMessageString = function (messages, msgObj) {
    _.forEach(messages, function (object) {
        if (msgObj.msg.length > 0) {
            msgObj.msg += '<br>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max([msgObj.level, object.level]);
    });
};

export let processPartialErrors = function (response) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if (response.ServiceData.partialErrors) {
        _.forEach(response.ServiceData.partialErrors, function (partialError) {
            getMessageString(partialError.errorValues, msgObj);
        });
    } else if (response.ServiceData.PartialErrors) {
        _.forEach(response.ServiceData.PartialErrors, function (partialError) {
            getMessageString(partialError.errorValues, msgObj);
        });
    }

    if (msgObj.level <= 1) {
        messagingService.showInfo(msgObj.msg);
    } else {
        messagingService.showError(msgObj.msg);
    }
};

export let processFailedIndexError = function (error) {
    var errorForInvalidIndex = false;
    _.forEach(error.cause.messages, function (message) {
        if (message.code === 126209) {
            errorForInvalidIndex = true;
            return;
        }
    });

    if (errorForInvalidIndex) {
        messagingService
            .showInfo('Indexes for the product are in the process of being updated. You will now be switched to non-index mode.');
        var value = {
            useProductIndex: false,
            startFreshNavigation: true
        };
        appCtxService.updatePartialCtx('aceActiveContext.context.configContext', value);
    }
};

var shouldClearRecipe = function (response) {
    var shouldClear = false;
    //Should clear the filter/recipe only if recipe or filter has changed.
    if (response.filter && response.filter.recipe &&
        (response.filter.recipe.length > 0 ||
            response.filter.recipe.length === 0 &&
            appCtxService.ctx.state.params.recipe)) {
        shouldClear = true;
    }
    return shouldClear;
};

/**
 * @param {ISOAResponse} response - SOA Response
 *
 * @return {Object} parameter map to store on URL.
 */
export let getNewStateFromGetOccResponse = function (response, contextState, soaInput) {
    var c_uid;
    var pci_uid;

    if (response.focusChildOccurrence) {
        if (response.focusChildOccurrence.occurrenceId &&
            cdm.isValidObjectUid(response.focusChildOccurrence.occurrenceId)) {
            c_uid = response.focusChildOccurrence.occurrenceId;
        } else if (response.focusChildOccurrence.occurrence) {
            c_uid = response.focusChildOccurrence.occurrence.uid;
        }
    }

    //In M/S mode, we don't want to enforce active product as selection on user. So, focus Occ from
    //server will not be set as new c_uid. Will continue with c_uid that we have
    if (!_.isEmpty(appCtxService.ctx.aceActiveContext.context.pwaSelectionModel) &&
        (appCtxService.ctx.aceActiveContext.context.pwaSelectionModel.multiSelectEnabled ||
            appCtxService.ctx.aceActiveContext.context.pwaSelectionModel.getCurrentSelectedCount() > 1)) {
        if (cdm.isValidObjectUid(response.focusProductContext.uid)) {
            c_uid = appCtxService.ctx[contextState.key].currentState.c_uid;
        }
    }

    pci_uid = response.focusProductContext ? response.focusProductContext.uid : null;

    var newState = {};

    // This if block can be simplified once server starts sending parentOccurrence.occurrenceId in case of product as well as SWC
    var o_uid;

    if (response.parentOccurrence) {
        if (!_.isEmpty(response.parentOccurrence.occurrenceId)) {
            o_uid = response.parentOccurrence.occurrenceId;
        } else if (response.parentOccurrence.occurrence) {
            o_uid = response.parentOccurrence.occurrence.uid;
        }
    }

    let uwc = response.userWorkingContextInfo;
    if (uwc && uwc.sublocationAttributes && uwc.sublocationAttributes.awb0ActiveSublocation) {
        newState.spageId = uwc.sublocationAttributes.awb0ActiveSublocation[0];
    }

    if (cdm.isValidObjectUid(o_uid)) {
        newState.o_uid = o_uid;
    }

    if (!cdm.isValidObjectUid(pci_uid)) {
        pci_uid = response.parentProductContext ? response.parentProductContext.uid : null;

        if (!cdm.isValidObjectUid(pci_uid)) {
            pci_uid = response.rootProductContext ? response.rootProductContext.uid : null;
        }
    }

    if (cdm.isValidObjectUid(pci_uid)) {
        newState.pci_uid = pci_uid;
    }

    if (!cdm.isValidObjectUid(newState.o_uid) && appCtxService.ctx[contextState.key].currentState.uid) {
        newState.o_uid = appCtxService.ctx[contextState.key].currentState.uid;
    }

    if (cdm.isValidObjectUid(c_uid)) {
        newState.c_uid = c_uid;
    } else {
        newState.c_uid = newState.o_uid;
    }

    if (shouldClearRecipe(response)) {
        newState.recipe = null;
    }

    if (appCtxService.ctx[contextState.key].currentState.snap_uid) {
        newState.snap_uid = null;
    }

    if( acePartialSelectionService.doesContainHiddenPackedSelection() && cdm.isValidObjectUid( soaInput.inputData.focusOccurrenceInput.element.uid ) ) {
        newState.c_uid = soaInput.inputData.focusOccurrenceInput.element.uid;
    }

    /**
     * Determine 'top' modelObject.
     */
    if (cdm.isValidObjectUid(newState.o_uid)) {
        var oModelObject = cdm.getObject(newState.o_uid);

        if (oModelObject) {
            var currModelObject = oModelObject;
            var topParentUid = oModelObject.uid;

            while (currModelObject) {
                var nextParentUid = occmgmtUtils.getParentUid(currModelObject);

                if (nextParentUid) {
                    currModelObject = cdm.getObject(nextParentUid);

                    if (currModelObject) {
                        topParentUid = currModelObject.uid;
                    }
                } else {
                    break;
                }
            }

            newState.t_uid = topParentUid;
        }
    }

    if (appCtxService.ctx[contextState.key].currentState.retainTreeExp) {
        newState.retainTreeExp = null;
    }

    //EXCL: BOM workset case. Populate the pci based on the c_uid from elementToPciMap
    if (response.elementToPCIMap && _isObjectBOMWorkset(cdm.getObject(newState.t_uid))) {
        let elementToPciMap = updateElementToPCIMap(response, contextState);
        let parentObject = cdm.getObject(newState.c_uid);
        do {
            if (parentObject && elementToPciMap[parentObject.uid]) {
                newState.pci_uid = elementToPciMap[parentObject.uid];
            }

            let parentUid = occmgmtUtils.getParentUid(parentObject);
            parentObject = cdm.getObject(parentUid);
        } while (parentObject && !_isObjectBOMWorkset(parentObject));
    }

    return newState;
};

function _isObjectBOMWorkset(object) {
    var isObjectBOMWorkset = false;
    if (object && object.props && object.props.awb0UnderlyingObject) {
        var underlyingObjUid = object.props.awb0UnderlyingObject.dbValues[0];
        var modelObjForUnderlyingObj = cdm.getObject(underlyingObjUid);
        if (modelObjForUnderlyingObj.modelType.typeHierarchyArray.indexOf('Fnd0WorksetRevision') > -1) {
            isObjectBOMWorkset = true;
        }
    }
    return isObjectBOMWorkset;
}

var _buildExistingParentChildrenInfosUsingLoadedVMObjects = function (vmc, deletedObjectUids, parentChildrenInfos) {
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    if (_.isUndefined(loadedVMObjects) || _.isEmpty(loadedVMObjects)) {
        return;
    }

    let loadedVMObjectUidsMap = new Map();
    _.forEach(loadedVMObjects, function (loadedVMObject) {
        loadedVMObjectUidsMap.set(loadedVMObject.uid, loadedVMObject);
    });

    _.forEach(deletedObjectUids, function (deletedObjectUid) {
        if (loadedVMObjectUidsMap.has(deletedObjectUid)) {
            let vmo = loadedVMObjectUidsMap.get(deletedObjectUid);
            vmo.markForDeletion = true;
        }
    });

    // check if any loaded view model tree node is parent
    _.forEach(loadedVMObjects, function (parentVMNode) {
        if (parentVMNode.children && !_.isEmpty(parentVMNode.children) && !parentVMNode.markForDeletion) {
            // if any loaded view mode tree node is parent, then build parentChildrenInfo
            let emptyCursor = {
                endIndex: parentVMNode.children,
                endOccUid: '',
                endReached: true,
                pageSize: 0,
                startIndex: 0,
                startOccUid: '',
                startReached: true
            };
            let parentChildrenInfo = {
                cursor: emptyCursor
            };
            parentChildrenInfo.parentInfo = _buildOccInfoFromVmo(parentVMNode);
            parentChildrenInfo.childrenInfo = [];
            _.forEach(parentVMNode.children, function (childVMNode) {
                if (loadedVMObjectUidsMap.has(childVMNode.uid)) {
                    let childVMO = loadedVMObjectUidsMap.get(childVMNode.uid);
                    if (!childVMO.markForDeletion) {
                        let childInfo = _buildOccInfoFromVmo(childVMO);
                        parentChildrenInfo.childrenInfo.push(childInfo);
                    }
                }
            });
            // update parent children info in output.
            parentChildrenInfos.push(parentChildrenInfo);
        }
    });
};

var _mergeDeltaParentChildrenInfos = function (deltaParentChildrenInfos, baseParentChildrenInfos) {
    // lets iterate through delta parent children info
    _.forEach(deltaParentChildrenInfos, function (deltaParentChildrenInfo) {
        // we can not assume server will always send children sorted by position.
        // But, insert logic ( splice ) expects deltaChildren should be sorted by position.
        var sortedDeltaChildren = _.sortBy(deltaParentChildrenInfo.childrenInfo, ['position']);

        var matchingBaseParentChildrenInfos = _.filter(baseParentChildrenInfos, function (baseParentChildrenInfo) {
            return baseParentChildrenInfo.parentInfo.occurrenceId === deltaParentChildrenInfo.parentInfo.occurrenceId;
        });

        if (!_.isEmpty(matchingBaseParentChildrenInfos)) {
            // we are merging the children for parent as it will have more children now.
            _.forEach(sortedDeltaChildren, function (childOccInfo) {
                if (childOccInfo.position !== -1) {
                    matchingBaseParentChildrenInfos[0].childrenInfo.splice(childOccInfo.position, 0, childOccInfo);
                } else {
                    matchingBaseParentChildrenInfos[0].childrenInfo.push(childOccInfo);
                }
            });
        } else {
            // we could not figure out parent in base parent children infos.
            baseParentChildrenInfos.push(deltaParentChildrenInfo);
        }
    });
};

var _buildOccInfoFromVmo = function (vmo) {
    var occInfo = {
        displayName: '',
        numberOfChildren: -1,
        occurrenceId: '',
        stableId: '',
        underlyingObjectType: '',
        occurrence: {
            cParamID: '',
            className: 'UnknownClass',
            objectID: '',
            type: 'unknownType',
            uid: 'AAAAAAAAAAAAAA'
        }
    };
    if (!_.isUndefined(vmo)) {
        occInfo.displayName = vmo.displayName;
        occInfo.numberOfChildren = vmo.isLeaf ? 0 : 1;
        occInfo.occurrenceId = vmo.uid;
        occInfo.stableId = vmo.stableId;
        occInfo.underlyingObjectType = vmo.type;
    }
    return occInfo;
};

var _setFocusAndParentOccurrences = function (response, focusObjectHierarchy) {
    if (response.parentChildrenInfos && response.parentChildrenInfos.length === 0) {
        return;
    }
    var focusObjectIdentified = false;
    // we wil check if focus object exists in newly built parent children info
    // else its parent is focus object.
    _.forEach(focusObjectHierarchy, function (focusObject) {
        if (focusObjectIdentified === true) {
            return false; // break
        }
        _.forEach(response.parentChildrenInfos, function (parentChildrenInfo) {
            if (focusObjectIdentified === true) {
                return false; // break
            }
            var childrenInfo = parentChildrenInfo.childrenInfo;
            _.forEach(childrenInfo, function (childInfo) {
                if (childInfo.occurrenceId === focusObject.uid) {
                    focusObjectIdentified = true;
                    response.focusChildOccurrence = childInfo;
                    response.parentOccurrence = parentChildrenInfo.parentInfo;
                    return false; // break
                }
            });
        });
    });
    if (focusObjectIdentified === false) {
        // we could not figure out focus object
        // focus on root object
        response.focusChildOccurrence = _buildOccInfoFromVmo(undefined /* build empty occ */);
        response.parentOccurrence = response.parentChildrenInfos[0].parentInfo;
    }
};

export let convertDeltaResponseToFullResponse = function (response, occContext, focusObjectHierarchy) {
    // we are here because, we have recieved delta response.
    // delta response can have below 3 events
    // 1. Remove -> Elements to remove will come in request preference ('deletedObjectUids')
    // 2. Modify -> Elements to modify will come in service data and service data handling takes care of
    // updating nodes from View Model Collection.
    // 3. Add -> Element to add will come in reponse.parentChildrenInfos. We have to merge these newly
    // added nodes into existing tree.
    var deletedObjectUids = [];
    if (response.requestPref && response.requestPref.deletedObjectUids && !_.isEmpty(response.requestPref.deletedObjectUids)) {
        // we are not expecting deletedObjectUids as part of service data.
        // Returning those results in cdm.deleted event, which deletes nodes in VMC.
        // On VMC update, tree gets refreshed with deleted elements first and treeLoadResult processing
        // takes care of adding nodes. This shows up as jitter.
        // To avoid above problem, instead of servceData.deleted = deletedObjectUids requestPref populated.
        deletedObjectUids = response.requestPref.deletedObjectUids;
    }

    var parentChildrenInfos = [];
    if (!_.isUndefined(occContext.vmc)) {
        _buildExistingParentChildrenInfosUsingLoadedVMObjects(occContext.vmc, deletedObjectUids, parentChildrenInfos);
    }

    if( _.isEmpty( response.parentChildrenInfos ) ||
        !_.isEmpty( response.parentChildrenInfos ) && _.isEmpty( response.parentChildrenInfos[0].childrenInfo ) ) {
        response.reloadSWANeeded = true;
    }


    if (!_.isUndefined(parentChildrenInfos) && !_.isEmpty(response.parentChildrenInfos)) {
        _mergeDeltaParentChildrenInfos(response.parentChildrenInfos, parentChildrenInfos);
    }
    // replace delta parent children infos with full parent children infos.

    response.parentChildrenInfos = parentChildrenInfos;
    _setFocusAndParentOccurrences(response, focusObjectHierarchy);
};

export default exports = {
    updateElementToPCIMap,
    populateRequestPrefInfoOnOccmgmtContext,
    populateFeaturesInfoOnOccmgmtContext,
    populateSourceContextToInfoMapOnOccmgmtContext,
    processPartialErrors,
    processFailedIndexError,
    getNewStateFromGetOccResponse,
    convertDeltaResponseToFullResponse
};
