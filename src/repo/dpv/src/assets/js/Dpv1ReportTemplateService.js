import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import awIconSvc from 'js/awIconService';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

var exports = {};

var _templateColConfigData;
var _promiseColumnConfig = null;

export let loadTemplatesData = function (searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput) {

    var deferred = AwPromiseService.instance.defer();

    var failureReason = awTableSvc.validateTreeLoadInput(treeLoadInput);

    if (failureReason) {
        deferred.reject(failureReason);

        return deferred.promise;
    }

    _buildTemplateStructure(searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, deferred);
    return deferred.promise;
};

function _buildTemplateStructure(searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, deferred) {
    var soaSearchInput = searchInput;
    var parentNode = treeLoadInput.parentNode;
    var targetNode = parentNode.isExpanded ? parentNode.uid : undefined;

    var policyID = policySvc.register({
        types: [{
            name: 'Folder',
            properties: [{
                name: 'object_string'
            }, {
                name: 'contents',
                modifiers: [{
                    name: 'withProperties',
                    Value: 'true'
                }]
            }]
        },
        {
            name: 'Dpv0MBQXml',
            properties: [{
                name: 'object_string'
            }]
        },
        {
            name: 'DPVRDL',
            properties: [{
                name: 'object_string'
            }]
        }]
    });

    var homeFolderUid = soaSearchInput.searchCriteria.parentUid;

    return dataManagementSvc.loadObjects([homeFolderUid]).then(function () {

        if (parentNode.isExpanded) {
            soaSearchInput.searchCriteria.parentUid = treeLoadInput.parentNode.uid;
        }

        var soaInput = {
            inflateProperties: false,
            columnConfigInput: columnConfigInput,
            searchInput: soaSearchInput
        };

        treeLoadInput.parentElement = targetNode && targetNode.levelNdx > -1 ? targetNode.id : 'AAAAAAAAAAAAAA';
        treeLoadInput.displayMode = 'Tree';

        return soaSvc.postUnchecked('Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', soaInput).then(
            function (response) {
                if (response.searchResultsJSON) {
                    response.searchResults = JSON.parse(response.searchResultsJSON);
                    delete response.searchResultsJSON;
                }

                var _proxyObjects = [];

                if (response && response.searchResults && response.searchResults.objects) {
                    var len = response.searchResults.objects.length;

                    for (var idx = 0; idx < len; idx++) {
                        _proxyObjects.push(viewModelObjectSvc.createViewModelObject(response.searchResults.objects[idx]));
                    }
                }

                response.searchResults = _proxyObjects;

                response.totalLoaded = _proxyObjects.length;

                if (!parentNode.isExpanded && response.ServiceData && response.ServiceData.plain) {
                    var plen = response.ServiceData.plain.length;
                    if (plen > 0) {
                        var newparentNode = createVMNodeUsingObjectInfo(cdm.getObject(homeFolderUid), 0, -1);
                        treeLoadInput.parentNode = newparentNode;
                        treeLoadInput.startChildNdx = 0;
                    }
                } else {
                    targetNode = parentNode.uid;
                    treeLoadInput.startChildNdx = 0;
                }

                var treeLoadResult = processProviderResponse(treeLoadInput, response.searchResults, homeFolderUid);
                if (response.columnConfig.columns[0]) {
                    response.columnConfig.columns[0].isTreeNavigation = true;
                }

                deferred.resolve({
                    treeLoadResult: treeLoadResult,
                    columnConfig: response.columnConfig
                });
            },
            function (error) {
                deferred.reject(error);
            });
    });
}

function createVMNodeUsingObjectInfo(obj, childNdx, levelNdx) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var hasFolderOrRepTemplate = containFolderOrRepTemplate(obj);

    var iconURL = null;

    if (obj.props) {
        if (obj.props.object_string) {
            displayName = obj.props.object_string.uiValues[0];
        }
    }

    if (!iconURL && obj) {
        iconURL = awIconSvc.getTypeIconFileUrl(obj);
    }

    var vmNode = awTableSvc
        .createViewModelTreeNode(objUid, objType, displayName, levelNdx, childNdx, iconURL);

    vmNode.isLeaf = !hasFolderOrRepTemplate;

    return vmNode;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} response - SOA Response
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
function processProviderResponse(treeLoadInput, searchResults, homeFolderUid) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];

    for (var childNdx = 0; childNdx < searchResults.length; childNdx++) {
        var object = searchResults[childNdx];
        var vmNode = createVMNodeUsingObjectInfo(object, childNdx, levelNdx);
        if (vmNode) {
            vmNodes.push(vmNode);
        }
    }
    var newTopNode = null;
    var treeLoadResult = {};
    if (!treeLoadInput.parentNode.isExpanded) {
        newTopNode = createVMNodeUsingObjectInfo(cdm.getObject(homeFolderUid), 0, treeLoadInput.parentNode.levelNdx);
        // Third Paramter is for a simple vs ??? tree
        treeLoadResult = awTableSvc.buildTreeLoadResult(treeLoadInput, vmNodes, false, true, true, newTopNode);

        updateTreeLoadResult(treeLoadInput, treeLoadResult, homeFolderUid);
    } else {
        treeLoadResult = awTableSvc.buildTreeLoadResult(treeLoadInput, vmNodes, false, true, true, null);
    }

    return treeLoadResult;
}

function updateTreeLoadResult(treeLoadInput, treeLoadResult, homeFolderUid) {
    treeLoadResult.showTopNode = true;

    var rootPathNodes = [];

    rootPathNodes.push(treeLoadResult.newTopNode);
    rootPathNodes.push(createVMNodeUsingObjectInfo(cdm.getObject(homeFolderUid), 0, 0));

    treeLoadResult.rootPathNodes = rootPathNodes;

    treeLoadResult.topModelObject = cdm.getObject(homeFolderUid);
    treeLoadResult.baseModelObject = cdm.getObject(homeFolderUid);
}

function containFolderOrRepTemplate(obj) {
    var verdict = false;
    if (obj.modelType.typeHierarchyArray.indexOf('Folder') > -1) {
        if (obj.props && obj.props.contents && obj.props.contents.dbValues &&
            obj.props.contents.dbValues.length > 0) {
            for (var i = 0; i < obj.props.contents.dbValues.length; i++) {
                var childObj = cdm.getObject(obj.props.contents.dbValues[i]);
                if (childObj.modelType.typeHierarchyArray.indexOf('Folder') > -1 ||
                    childObj.modelType.typeHierarchyArray.indexOf('Dpv0MBQXml') > -1 ||
                    childObj.modelType.typeHierarchyArray.indexOf('DPVRDL') > -1) {
                    verdict = true;
                    break;
                }
            }
        }
    }
    return verdict;
}

export let loadTreeTableProperties = function (subPanelContext) { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput(arguments);

    if (propertyLoadInput) {
        return _loadProperties(propertyLoadInput, subPanelContext);
    }

    return AwPromiseService.instance.reject('Missing PropertyLoadInput parameter');
};

function _loadProperties(propertyLoadInput, subPanelContext) {
    var allChildNodes = [];
    var columnPropNames = [];
    var allChildUids = [];

    columnPropNames.push('awp0ThumbnailImageTicket');

    /**
     * Note: Assume each propertyLoadRequest has the same columns
     */
    if (!_.isEmpty(propertyLoadInput.propertyLoadRequests)) {
        _.forEach(propertyLoadInput.propertyLoadRequests[0].columnInfos, function (columnInfo) {
            columnPropNames.push(columnInfo.name);
        });
    }

    _.forEach(propertyLoadInput.propertyLoadRequests, function (propertyLoadRequest) {
        _.forEach(propertyLoadRequest.childNodes, function (childNode) {
            if (!childNode.props) {
                childNode.props = {};
            }

            if (cdm.isValidObjectUid(childNode.uid) && childNode.uid !== 'top') {
                allChildNodes.push(childNode);
                allChildUids.push(childNode.uid);
            }
        });
    });

    var propertyLoadResult = awTableSvc.createPropertyLoadResult(allChildNodes);

    var selectedMO = subPanelContext.provider.baseSelection;

    if (selectedMO && cdm.isValidObjectUid(selectedMO.uid)) {
        allChildUids.push(selectedMO.uid);
    }

    if (_.isEmpty(allChildUids)) {
        return AwPromiseService.instance.resolve({
            propertyLoadResult: propertyLoadResult
        });
    }

    columnPropNames = _.uniq(columnPropNames);
    allChildUids = _.uniq(allChildUids);

    return dataManagementSvc.loadObjects(allChildUids).then(
        function () { // eslint-disable-line no-unused-vars
            var vmoObjs = [];
            /**
             * Create a ViewModelObject for each of the returned 'child' nodes
             */
            _.forEach(allChildNodes, function (childNode) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject(cdm
                    .getObject(childNode.uid), 'EDIT');

                vmoObjs.push(vmo);
            });
            return tcVmoService.getViewModelProperties(vmoObjs, columnPropNames).then(
                function () {
                    /**
                     * Create a ViewModelObject for each of the returned 'child' nodes
                     */
                    _.forEach(vmoObjs, function (vmo) {
                        if (vmo.props) {
                            _.forEach(allChildNodes, function (childNode) {
                                if (childNode.uid === vmo.uid) {
                                    if (!childNode.props) {
                                        childNode.props = {};
                                    }
                                    _.forEach(vmo.props, function (vmProp) {
                                        childNode.props[vmProp.propertyName] = vmProp;
                                    });
                                }
                            });
                        }
                    });

                    return {
                        propertyLoadResult: propertyLoadResult
                    };
                });
        });
}

export const loadTreeTableColumns = (dataProvider) => {
    _promiseColumnConfig = AwPromiseService.instance.defer();

    var soaInput = {
        getOrResetUiConfigsIn: [{
            scope: 'LoginUser',
            clientName: 'AWClient',
            resetColumnConfig: false,
            columnConfigQueryInfos: [{
                clientScopeURI: 'Awp0SearchResults',
                operationType: 'configured'
            }],
            businessObjects: ''
        }]
    };

    soaSvc.postUnchecked('Internal-AWS2-2022-06-UiConfig', 'getOrResetUIColumnConfigs3', soaInput).then(
        function (response) {
            // Process returned column data
            var columns;

            if (_isArrayPopulated(response.columnConfigurations)) {
                var columnConfigurations = response.columnConfigurations[0];

                if (_isArrayPopulated(columnConfigurations.columnConfigurations)) {
                    columnConfigurations = columnConfigurations.columnConfigurations;

                    if (_isArrayPopulated(columnConfigurations)) {
                        columns = _processUiConfigColumns(columnConfigurations[0].columns);
                    }
                }
            }
            _templateColConfigData = { columnInfos: columns };

            _promiseColumnConfig.resolve();
        },
        function (error) {
            _promiseColumnConfig.reject(error);
        });

    return promiseColumnConfig().then(function () {
        dataProvider.columnConfig = {
            columns: _templateColConfigData.columnInfos
        };

        return _templateColConfigData;
    });
};

function promiseColumnConfig() {
    var deferred = AwPromiseService.instance.defer();
    if (_promiseColumnConfig.promise) {
        _promiseColumnConfig.promise.then(

            function () {
                deferred.resolve();
            },
            function () {
                deferred.reject();
            });
    } else {
        deferred.reject();
    }

    return deferred.promise;
}

function _isArrayPopulated(object) {
    var isPopulated = false;
    if (object && object.length > 0) {
        isPopulated = true;
    }
    return isPopulated;
}

function _processUiConfigColumns(columns) {
    var _treeColumnInfos = [];
    var colInfoParams = {};
    for (var idx = 0; idx < columns.length; ++idx) {
        colInfoParams = {
            name: columns[idx].propertyName,
            propertyName: columns[idx].propertyName,
            displayName: columns[idx].displayName,
            typeName: columns[idx].typeName,
            maxWidth: 400,
            minWidth: 60,
            hiddenFlag: columns[idx].hiddenFlag,
            pixelWidth: columns[idx].pixelWidth,
            width: columns[idx].pixelWidth,
            enableCellEdit: false,
            enableColumnMenu: true,
            enableFiltering: false,
            enablePinning: true,
            enableColumnMoving: true
        };

        var columnInfo = awColumnSvc.createColumnInfo(colInfoParams);

        _treeColumnInfos.push(columnInfo);
    }
    return _treeColumnInfos;
}

export default exports = {
    loadTemplatesData,
    loadTreeTableProperties,
    loadTreeTableColumns
};
