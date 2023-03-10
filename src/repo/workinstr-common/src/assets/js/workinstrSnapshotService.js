// Copyright (c) 2021 Siemens

/**
 * @module js/workinstrSnapshotService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import SessionContextService from 'js/sessionContext.service';
import soaService from 'soa/kernel/soaService';
import viewerPreferenceSvc from 'js/viewerPreference.service';
import preferenceService from 'soa/preferenceService';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import viewerContextSvc from 'js/viewerContext.service';
import viewerRenderSvc from 'js/viewerRender.service';
import frameAdapterSvc from 'js/frameAdapter.service';
import viewerSecurityMarkingSvc from 'js/viewerSecurityMarkingService';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import logger from 'js/logger';
import mfeSecurityMarkingService from 'js/services/mfeSecurityMarkingService';
import geometricAalysisSvc from 'js/Awv0GeometricAnalysisMeasureService';
import viewerMeasureSvc from 'js/viewerMeasureService';
import fmsUtils from 'js/fmsUtils';

// import 'plmvisrl';
import '@swf/ClientViewer';
// import 'manipulator';

/**
 * The TC (SOA) proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
 */
var WEB_XML_SOA_PROXY_CONTEXT = 'tc';

/**
 * The Vis proxy servlet context. This must be the same as the VisPoolProxy mapping in the web.xml
 */
var WEB_XML_VIS_PROXY_CONTEXT = 'VisProxyServlet' + '/';

/**
 * Relative path to client side accessible SOA services. Specifically this is the root path, not the path
 * which AWC client generally sends requests to.
 */
var CLIENT_SOA_PATH = WEB_XML_SOA_PROXY_CONTEXT + '/';

/**
 * Host config token
 */
var AW_HOST_CONFIG_TOKEN = 'aw_hosting_config';

/**
 * Is viewer supported token
 */
var IS_VIEWER_SUPPORTED_TOKEN = 'IS_VIEWER_SUPPORTED';

/**
 * {String} Variable holding the soa path url.
 */
var _soaPath;

/**
 * Viewer div element
 */
var _lastViewerDivElement = null;

/**
 * Viewer view object
 */
var _lastViewerCtxObj = null;

/**
 * Viewer last product context info
 */
var _lastProductContextInfoObj = null;

/**
 * Viewer last context namespace
 */
var _lastViewerCtxNamespace = null;

/**
 * Set the data needed for capture image and PMI commands
 *
 * @param {String} viewerCtxNamespace the viewer context namespace
 * @param {String} rootModelObjectPath the rootModelObject path in the viewer context namespace
 */
export let setViewerCtxData = function (viewerCtxNamespace, rootModelObjectPath) {
    const toolsAndInfoCtx = appCtxSvc.getCtx('activeToolsAndInfoCommand');
    if (!toolsAndInfoCtx || toolsAndInfoCtx && toolsAndInfoCtx.commandId !== 'Awv0CaptureGallery' && toolsAndInfoCtx.commandId !== 'Awv0GeometricAnalysisSection') {
        const visCtx = appCtxSvc.getCtx('workinstr0Vis');
        if (visCtx.selectedRevObj) {
            appCtxSvc.updatePartialCtx(rootModelObjectPath, visCtx.selectedRevObj);
        }
        let viewerCtx = appCtxSvc.getCtx('viewer');
        if (!viewerCtx) {
            viewerCtx = {
                activeViewerCommandCtx: viewerCtxNamespace
            };
            appCtxSvc.registerCtx('viewer', viewerCtx);
        } else {
            appCtxSvc.updatePartialCtx('viewer.activeViewerCommandCtx', viewerCtxNamespace);
        }
    }
};

/**
 * Clean up previous view
 */
export let cleanUpPreviousView = function () {
    if (_lastViewerCtxObj) {
        _lastViewerCtxObj.close();
        // Reinitialize last product context info and viewer context object to null since viewer associated no longer exists.
        _lastViewerCtxObj = null;
        _lastProductContextInfoObj = null;
        _lastViewerCtxNamespace = null;
    }
};

/**
 * Get the modelObject clone stable id
 *
 * @param {Object} modelObjectUid the model object to get its clone stable id
 *
 * @return {String} uid the clone stable uid
 */
export let getCloneStableId = function (modelObjectUid) {
    var cloneStableIDPropValue;
    var cloneStableIDChain = modelObjectUid.props.ewi0CloneStableIDChain;
    if (cloneStableIDChain) {
        cloneStableIDPropValue = cloneStableIDChain.dbValues[0];
        if (cloneStableIDPropValue && cloneStableIDPropValue !== null && !_.isEmpty(cloneStableIDPropValue)) {
            // The server returns a value with extra '//' at the beginning and a missing '/' at the end
            cloneStableIDPropValue = cloneStableIDPropValue.substring(2) + '/';
        }
    }
    return cloneStableIDPropValue;
};

/**
 * Check if same product being opened as previous
 *
 * @param {Object} productCtxInfo product context info object
 *
 * @return {Boolean} True is same product is being opened
 */
export let isSameProductOpenedAsPrevious = function (productCtxInfo) {
    return _lastProductContextInfoObj && _lastProductContextInfoObj.uid === productCtxInfo.uid;
};

/**
 * Check if product being opened on same contextNamespace as previous
 *
 * @param {Object} productCtxInfo product context info object
 *
 * @return {Boolean} True is same product is being opened on same contextNamespace
 */
export let isSameContextNamespaceAsPrevious = function (productCtxInfo) {
    return _lastViewerCtxNamespace === productCtxInfo.contextNamespace;
};

/**
 * Check if same product being opened as previous
 *
 * @return {Promise} A promise that return the viewer view and context object once resolved
 */
export let restorePreviousView = function () {
    var returnPromise = AwPromiseService.instance.defer();
    returnPromise.resolve([_lastViewerCtxObj, _lastViewerDivElement]);
    updateViewerContextWithVisibility(_lastViewerCtxObj, true);
    return returnPromise.promise;
};

/**
 * Set viewer visibility in viewer application context
 *
 * @param {ViewerContextData} viewerCtxData viewer context data
 * @param {Boolean} isViewerVisible true if viewer is visible
 */
export let updateViewerContextWithVisibility = function (viewerCtxData, isViewerVisible) {
    viewerRenderSvc.updateViewerContextWithVisibility(viewerCtxData, isViewerVisible);
};

/**
 * Get viewer view
 *
 * @param {Object} viewerLoadInputParams desired viewer height
 * @param {Boolean} isViewerReload is viewer being reload
 *
 * @return {Promise} A promise that return the viewer view and context object once resolved
 */
export let getViewerView = function (viewerLoadInputParams) {
    var returnPromise = AwPromiseService.instance.defer();
    var productCtxInfo = viewerLoadInputParams.getTargetObject();
    var viewerloadPromise = loadByModelObjectInputParam(viewerLoadInputParams);
    viewerloadPromise.then(function (viewerData) {
        _lastProductContextInfoObj = productCtxInfo;
        _lastViewerCtxObj = viewerData;
        _lastViewerDivElement = viewerLoadInputParams.getViewerContainer();
        _lastViewerCtxNamespace = viewerLoadInputParams.getViewerCtxNamespace();
        returnPromise.resolve([viewerData, viewerLoadInputParams.getViewerContainer()]);
    }, function (errorMsg) {
        returnPromise.reject(errorMsg);
    });

    return returnPromise.promise;
};

/**
 * Get viewer message for key
 *
 * @param {String} key the message key
 *
 * @returns {String} the message
 */
var _getViewerMessage = function (key) {
    var returnPromise = AwPromiseService.instance.defer();
    localeSvc.getTextPromise('Awv0threeDViewerMessages').then(
        function (localTextBundle) {
            returnPromise.resolve(localTextBundle[key]);
        },
        function (error) {
            returnPromise.reject(error);
        });
    return returnPromise.promise;
};

/**
 * Evaluates if hosting is supported
 *
 * @returns {Boolean} true if supported
 */
var _evaluateAvailabilityInHosting = function () {
    var hostConfig = appCtxSvc.getCtx(AW_HOST_CONFIG_TOKEN);
    var isSupported = true;

    if (!_.isUndefined(hostConfig)) {
        isSupported = hostConfig[IS_VIEWER_SUPPORTED_TOKEN];

        if (!_.isUndefined(isSupported) && !isSupported) {
            _getViewerMessage('viewerEnvironmentNotSupported').then(function (localizedErrorMsg) {
                msgSvc.showError(localizedErrorMsg);
            });
        }
    }

    return isSupported === true;
};

/**
 * Sets license level in the context.
 *
 * @param  {Object} viewerView viewer view
 */
var _setLicenseLevelInCtx = function (viewerView) {
    var viewerLicenseCtxPath = viewerContextSvc.VIEWER_NAMESPACE_TOKEN + '.' + viewerContextSvc.VIEWER_LICENSE_LEVEL_TOKEN;
    viewerView.getVisLicenseLevels(window.JSCom.Consts.LICENSE_LEVELS.ALL).then(function (licLevels) {
        appCtxSvc.updatePartialCtx(viewerLicenseCtxPath, licLevels.iCO_VisUserLicense);
    }, function (reason) {
        logger.error('viewerRender: Failed to fetch viewer license level:' + reason);
        appCtxSvc.updatePartialCtx(viewerLicenseCtxPath, viewerContextSvc.ViewerLicenseLevels.BASE);
    });
};
/**
 * Set viewer visibility in viewer application context
 *
 * @param {String} viewerCtxNamespace viewer context name space
 * @param {Boolean} isViewerVisible true if viewer is visible
 */
export let updateViewerVisibility = function (viewerCtxNamespace, isViewerVisible) {
    let viewerCtx = viewerContextSvc.getRegisteredViewerContext(viewerCtxNamespace);
    viewerRenderSvc.updateViewerVisibility(viewerCtx, isViewerVisible);
};

/**
 * Get viewer load input parameters
 *
 * @param {ModelObject} datasetObj - The snapshot dataset model object
 * @param {Number} viewerWidth desired viewer width
 * @param {Number} viewerHeight desired viewer height
 *
 * @return {Object} input load parameters
 */
export let getViewerLoadInputParameter = function (datasetObj, viewerWidth, viewerHeight) {
    var returnPromise = AwPromiseService.instance.defer();

    var visCtx = appCtxSvc.getCtx('workinstr0Vis');
    var topLine = visCtx.selectedObj;

    var viewerLoadInputParams = viewerRenderSvc.getViewerLoadInputParameters();
    viewerLoadInputParams.setTargetObject(datasetObj);
    viewerLoadInputParams.setProductUids([topLine.uid]);
    viewerLoadInputParams.setViewerCtxNamespace(datasetObj.contextNamespace);
    viewerLoadInputParams.setViewerContainer(document.createElement('div'));
    viewerLoadInputParams.setHeight(parseInt(viewerHeight));
    viewerLoadInputParams.setWidth(parseInt(viewerWidth));
    // Should be true for JT and false for snapshot - shows all the structure
    viewerLoadInputParams.setShowAll(datasetObj.type === 'DirectModel');

    if (visCtx.snapshotConfiguration === 'Dynamic') {
        createVVIFileDynamic(datasetObj, topLine).then(function (additionalInfo) {
            additionalInfo = addPMIRelatedInformation(additionalInfo, topLine);
            viewerLoadInputParams.setAdditionalInfo(additionalInfo);
            returnPromise.resolve(viewerLoadInputParams);
        }, function (errorMsg) {
            returnPromise.reject(errorMsg);
        });
    } else { // Default is always static configuration
        createVVIFileStatic(datasetObj).then(function (additionalInfo) {
            additionalInfo = addPMIRelatedInformation(additionalInfo, topLine);
            viewerLoadInputParams.setAdditionalInfo(additionalInfo);
            returnPromise.resolve(viewerLoadInputParams);
        }, function (errorMsg) {
            returnPromise.reject(errorMsg);
        });
    }

    return returnPromise.promise;
};

/**
 * Load viewer by model object
 *
 * @param {ViewerLoadInputParameters} viewerLoadInputParameters Model object for which viewer needs to be loaded
 *
 * @returns {Object} Promise once resolved will provide a Viewer View object that controls viewer
 */
export let loadByModelObjectInputParam = function (viewerLoadInputParameters) {
    var returnPromise = AwPromiseService.instance.defer();
    var viewerCtxName = viewerLoadInputParameters.getViewerCtxNamespace();
    var vType = viewerLoadInputParameters.getViewerType();

    if (_.isUndefined(viewerCtxName) || _.isNull(viewerCtxName) || _.isEmpty(viewerCtxName)) {
        viewerCtxName = viewerRenderSvc.getDefaultViewerNamespace();
    }

    if (_.isUndefined(vType) || _.isNull(vType) || _.isEmpty(vType)) {
        vType = viewerContextSvc.ViewerType.JsViewer;
    }

    viewerContextSvc.createViewerApplicationContext(viewerCtxName);
    updateViewerVisibility(viewerCtxName, false);

    if (!_evaluateAvailabilityInHosting()) {
        returnPromise.reject();
        return returnPromise.promise;
    }

    var fmsTicketPromise = createLaunchFile(viewerLoadInputParameters.getAdditionalInfo());
    fmsTicketPromise.then(function (fmsTkt) {
        viewerPreferenceSvc.getViewerPreferences(viewerLoadInputParameters.isShowAll()).then(function (viewerPreferences) {
            var renderer = null;
            var VIEWER_RENDER_OPTION = preferenceService.getLoadedPrefs().AWV0ViewerRenderOption;

            if (!VIEWER_RENDER_OPTION || VIEWER_RENDER_OPTION.length === 0) {
                VIEWER_RENDER_OPTION = ['SSR'];
            }
            appCtxSvc.updatePartialCtx('viewer.viewerMode', VIEWER_RENDER_OPTION[0]);
            if (Array.isArray(VIEWER_RENDER_OPTION) && VIEWER_RENDER_OPTION[0] === 'CSR') {
                renderer = window.JSCom.Consts.ImplType.TRIANGLE;
            } else if (Array.isArray(VIEWER_RENDER_OPTION) && VIEWER_RENDER_OPTION[0] === 'SSR') {
                renderer = window.JSCom.Consts.ImplType.PICTURE;
            }
            var moniker = new window.JSCom.Render.MonikerFMSTicket(
                frameAdapterSvc.getConnectionUrl(), fmsTkt, viewerLoadInputParameters.getProductUids(), renderer);
            if (!viewerLoadInputParameters.hasInitialized()) {
                viewerLoadInputParameters.initializeViewerContext();
            }
            var viewerView = viewerLoadInputParameters.getViewerView();

            viewerSecurityMarkingSvc.setupSecurityMarking(viewerView, mfeSecurityMarkingService.securityMarkingCallBackFunc);

            var loadingOptions = {};
            loadingOptions.preferences = viewerPreferences;
            var open3DViewPromise = viewerView.openMoniker(moniker,
                loadingOptions);
            // Make sure both promises are resolved before proceeding
            open3DViewPromise.then(function () {
                _setLicenseLevelInCtx(viewerView);
                updateViewerVisibility(viewerCtxName, true);
                viewerPreferenceSvc.loadViewerPreferencesFromVisSession(viewerLoadInputParameters.getViewerContext());
                returnPromise.resolve(viewerLoadInputParameters.getViewerContext());
            }, function (errorMsg) {
                returnPromise.reject(errorMsg);
                if (errorMsg.message) {
                    if (_.includes(errorMsg.message, 'All Pool Managers are full')) {
                        _getViewerMessage('poolManagerFull').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else if (_.includes(errorMsg.message, 'No Pool Managers were found')) {
                        _getViewerMessage('poolManagerDown').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else if (errorMsg.message === 'ErrorName:' || _.includes(errorMsg.message, 'Failed to connect to server')) {
                        _getViewerMessage('viewerNotConfigured').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else if (_.includes(errorMsg.message,
                        'MMV is not supported for Client Side rendering')) {
                        _getViewerMessage('mmvDataNotViewable').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else if (_.includes(errorMsg.message,
                        'Not enough storage is available to complete this operation')) {
                        _getViewerMessage('notEnoughBrowserStorage').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else if (_.includes(errorMsg.message, 'Problem processing HTTP request')) {
                        _getViewerMessage('problemInHttpReq').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else if (_.includes(errorMsg.message, 'Could not initialize the rendering component due to web browser limitations')) {
                        _getViewerMessage('browserLimitation').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    } else {
                        _getViewerMessage('vviLaunchFailed').then(function (localizedErrorMsg) {
                            msgSvc.showError(localizedErrorMsg);
                        });
                    }
                } else {
                    _getViewerMessage('vviLaunchFailed').then(function (localizedErrorMsg) {
                        msgSvc.showError(localizedErrorMsg);
                    });
                }
            });
        });
    },
        function (errorMsg) {
            returnPromise.reject(errorMsg);
            msgSvc.showError(errorMsg.toString());
        });
    return returnPromise.promise;
};

/**
 * Creates the vvi file for the snapshots with dynamic loading. Meaning, when this vvi will be loaded in Vis, it
 * will reconfigure the structures using VisSC
 *
 * @param {ModelObject} datasetObj - The snapshot dataset model object
 * @param {ModelObject} topLine - The top bomline from the given BOMLine (the currStep topLine). Assumes that bl_parent method is cached for entire hierarchy!
 *
 * @return {String} vviTicket
 */
export let createVVIFileDynamic = function (datasetObj, topLine) {
    var returnPromise = AwPromiseService.instance.defer();

    // First get the vis structure context for the top line
    var input = {
        info: [{ occurrencesList: [topLine] }]
    };

    // Returns the vis context uid of the given dataset
    soaService.post('Visualization-2013-12-StructureManagement', 'createVisSCsFromBOMsWithOptions', input)
        .then(function (response) {
            var output = response.output;
            if (output && output.length > 0) {
                var baseUid = output[0].structureRecipe.uid;

                var idInfos = {
                    id: {
                        type: datasetObj.type,
                        uid: datasetObj.uid
                    },
                    idAdditionalInfo: {
                        BaseDoc_UID: baseUid,
                        TransientDoc: 'True'
                    },
                    item: null,
                    itemRev: null,
                    operation: 'Open'
                };

                returnPromise.resolve(idInfos);
            }
        });
    return returnPromise.promise;
};

/**
 * Create the vvi file for the snapshots with static loading. Meaning, when this vvi will be loaded in Vis, it will
 * not reconfigure the structures.
 *
 * @param {ModelObject} datasetObj - The snapshot dataset model object
 *
 * @return {String} vviTicket
 */
export let createVVIFileStatic = function (datasetObj) {
    /**
     * @param id A required parameter that references the object to be launched. If needed, launched object will be
     *            resolved by the server to a launch able object.
     * @param item An optional object reference of the Item containing launch able object. If this is not known, the
     *            server will attempt to identify the parent if it can.
     * @param itemRev An optional object reference of the <b>ItemRevision</b> containing launchable object. If this is
     *            not known, the server will attempt to identify if it can.
     * @param operation An optional parameter references the type of launch action. This controls the action the viewer
     *            will perform when it opens the object. The actions supported are one of following: <code>Open</code>,
     *            <code>Insert</code>, <code>Merge</code> or <code>Interop</code>. <code>Open</code> will open the
     *            object in a new window. <code>Insert</code> will insert the object into the current window that has
     *            focus. <code>Merge</code> will attempt to merge a pruned product structure with one that is already
     *            open if it can. <code>Interop</code> will present a dialog that lets the user select the launch
     *            action.
     */
    // In order to load the PV with Static mode, the operation must be "Interop". If we send "Open" as
    // operation, it disregards the Static mode!
    var returnPromise = AwPromiseService.instance.defer();

    var idInfo = {
        id: {
            type: datasetObj.type,
            uid: datasetObj.uid
        },
        idAdditionalInfo: {
            OperationStructure: 'Static',
            VisDoc_UID: datasetObj.uid
        },
        item: null,
        itemRev: null,
        operation: 'Interop'
    };

    returnPromise.resolve(idInfo);
    return returnPromise.promise;
};

/**
 * Get default SOA path information
 *
 * @function _getDefaultSoaPath
 * @memberof frameAdapterService
 *
 * @return {Object} A default SOA path string
 */
function _getDefaultSoaPath() {
    return browserUtils.getBaseURL() + CLIENT_SOA_PATH;
}

/**
 * Get SOA path information from vis server
 *
 * @function _getSoaPath
 * @memberof frameAdapterService
 *
 * @return {Promise} A promise resolved once SOA path info is obtained
 */
function _getSoaPath() {
    if (!_.isEmpty(_soaPath)) {
        return AwPromiseService.instance.resolve(_soaPath);
    }

    var connectionUrl = browserUtils.getBaseURL() + WEB_XML_VIS_PROXY_CONTEXT;

    return window.JSCom.Health.HealthUtils.getSOAFullPath(connectionUrl).then(
        function (soaPathFromVisServer) {
            if (!_.isEmpty(soaPathFromVisServer)) {
                _soaPath = soaPathFromVisServer;
            } else {
                _soaPath = _getDefaultSoaPath();
            }
            return _soaPath;
        },
        function () {
            _soaPath = _getDefaultSoaPath();

            return _soaPath;
        });
}

/**
 * Get server information from vis server
 *
 * @function _getServerInfo
 * @memberof frameAdapterService
 *
 * @return {Promise} A promise resolved once server info is obtained
 */
function _getServerInfo() {
    return _getSoaPath().then(function (soaPath) {
        var protocol = soaPath.substring(0, soaPath.indexOf('://', 0));

        var returnObject = {};

        returnObject.protocol = protocol;
        returnObject.hostpath = soaPath;
        returnObject.servermode = 4;

        return returnObject;
    });
}

/**
 * Get client information
 *
 * @function _getUserAgentInfo
 * @memberof frameAdapterService
 *
 * @return {Object} Client information
 */
function _getUserAgentInfo() {
    var userAgentInfo = {};

    userAgentInfo.userApplication = SessionContextService.getClientID();
    userAgentInfo.userAppVersion = SessionContextService.getClientVersion();

    return userAgentInfo;
}

/**
 * Create launch file api
 *
 * @function createLaunchFile
 * @memberof frameAdapterService
 *
 * @param {Object} additionalInfo - Additional information
 *
 * @return {Promise} A promise resolved once fms ticket is created
 */
var createLaunchFile = function (additionalInfo) {
    return _getServerInfo().then(function (serverInfo) {
        var userAgentInfo = _getUserAgentInfo();

        var sessionDescVal = SessionContextService.getSessionDiscriminator();

        var sessionInfo = {};

        sessionInfo.sessionDescriminator = sessionDescVal;
        sessionInfo.sessionAdditionalInfo = {};
        sessionInfo.sessionAdditionalInfo.CLIENT = 'AW';

        var idInfos = [];

        idInfos.push(additionalInfo);

        var input = {};

        input.idInfos = idInfos;
        input.serverInfo = serverInfo;
        input.userDataAgentInfo = userAgentInfo;
        input.sessionInfo = sessionInfo;

        return soaService.post('Visualization-2011-02-DataManagement', 'createLaunchFile', input)
            .then(function (response) {
                return response.ticket;
            });
    });
};

/**
 * Adds information related to PMI visualisation
 *
 * @function addPMIRelatedInformation
 * @memberof workinstrSnapshotService
 *
 * @param {Object} additionalInfo - Additional information
 *
 * @param {Object} topLine - topLine
 *
 * @return {Object} additionalInfo - Additional information
 */
function addPMIRelatedInformation(additionalInfo, topLine) {
    let headerProps = appCtxSvc.getCtx('EWI0HeaderProperties');
    let mbomRoot = null;
    //for work instructions
    if (headerProps && headerProps.length > 0) {
        mbomRoot = headerProps.filter(prop => prop.propertyName === 'MBomRoot');
    }

    /**
         * adding the data required to load PMIs consumed under selected operation
         * Key = StrucExpandClientControlInfo
         * Vaue = EBOM Root ; selected operation
         */
    if (mbomRoot) {
        const pmiInfo = mbomRoot + ';' + topLine.uid;
        additionalInfo.idAdditionalInfo.StrucExpandClientControlInfo = pmiInfo;


        // Adding key for default selection in standalone vis
        additionalInfo.idAdditionalInfo.DefaultPVAnchorUID = topLine.uid;

        if (topLine.props.bl_clone_stable_occurrence_id && topLine.props.bl_clone_stable_occurrence_id.dbValues.length > 0
            && topLine.props.bl_clone_stable_occurrence_id.dbValues[0] !== '') {
            additionalInfo.idAdditionalInfo.PMITargetIds = topLine.props.bl_clone_stable_occurrence_id.dbValues[0];
        }
    }

    return additionalInfo;
}

/**
 * Creates a vvi file to open in Visualisation application
 *
 * @function openInVis
 * @memberof workinstrSnapshotService
 *
 * @param {Object} selectedSnapshot - Snapshot Model Object
 */
 function openInVisulisationApplication( selectedSnapshot ) {
    const visCtx = appCtxSvc.getCtx( 'workinstr0Vis' );
    const topLine = visCtx.selectedObj;

     return createVVIFileDynamic( selectedSnapshot, topLine ).then( function( additionalInfo ) {
        additionalInfo = addPMIRelatedInformation( additionalInfo, topLine );
        return  createLaunchFile( additionalInfo ).then( function( fmsTkt )
         {
            const fileName = fmsUtils.getFilenameFromTicket( fmsTkt );
                                fmsUtils.openFile( fmsTkt, fileName );
        } );
    } );
}

/**

/**
 *
 * @param {*} viewerAtomicData  viewerAtomicData
 * @param {*} orientation orientation
 */
function setViewerOrientation(viewerAtomicData, orientation) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    viewerContextSvc.executeViewOrientationCommand(viewerCtxData, orientation);
}

/**
 *
 * @param {*} viewerAtomicData viewerAtomicData
 * @param {*} orientation orientation
 */
function updateViewerToFit(viewerAtomicData) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    try {
        viewerCtxData.getNavigationManager().viewAll();
    } catch (error) {
        logger.error('Failed to execute fit command: ' + error);
    }
}
/**
 *
 * @param {Object} viewerAtomicData viewerAtomicData
 * @param {String} navigationMode navigationMode
 */
function setNavigationMode(viewerAtomicData, navigationMode) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    viewerContextSvc.setNavigationMode(viewerCtxData, navigationMode);
}
/**
 *
 * @param {Object} viewerAtomicData viewerAtomicData
 */
function toggleUseTransparency(viewerAtomicData) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    viewerContextSvc.toggleUseTransparency(viewerCtxData);
}

/**
 *
 * @param {Object} viewerAtomicData  viewerAtomicData
 * @param {String} commandId  commandId
 */
function toggleSingleMeasurementSubCommandsToolbar(viewerAtomicData, commandId) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    geometricAalysisSvc.toggleSingleMeasurementSubCommandsToolbar(commandId, viewerCtxData);
}
/**
 *
 * @param {Object} viewerAtomicData viewerAtomicData
 */
function toggleQuickMeasurementMode(viewerAtomicData) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    let nameSpace = viewerCtxData.getViewerCtxNamespace();
    viewerMeasureSvc.toggleQuickMeasurementMode(nameSpace);
}
/**
 *
 * @param {*} viewerAtomicData  viewerAtomicData
 * @param {*} filterName filterName
 */
function setQuickMeasureFilter(viewerAtomicData, filterName) {
    let viewerCtxData = viewerAtomicData.getValue().viewerCtxData;
    let nameSpace = viewerCtxData.getViewerCtxNamespace();
    viewerMeasureSvc.setQuickMeasurementPickFilter(nameSpace, filterName);
}
/**
 * A glue code to support work instructions Snapshot
 *
 * @param {Object} $q - $q
 * @param {Object} appCtxSvc - appCtxService
 * @param {Object} SessionContextService - SessionContextService
 * @param {Object} soaService - soa_kernel_soaService
 * @param {Object} viewerPreferenceSvc - viewerPreferenceService
 * @param {Object} preferenceService - soa_preferenceService
 * @param {Object} localeSvc - localeService
 * @param {Object} msgSvc - messagingService
 * @param {Object} viewerContextSvc - viewerContextService
 * @param {Object} viewerRenderSvc - viewerRenderService
 * @param {Object} frameAdapterSvc - frameAdapterService
 * @param {Object} viewerSecurityMarkingSvc - viewerSecurityMarkingService
 *
 * @return {Object} - Service instance
 *
 * @member workinstrSnapshotService
 */
export default {
    setViewerCtxData,
    cleanUpPreviousView,
    getCloneStableId,
    isSameProductOpenedAsPrevious,
    isSameContextNamespaceAsPrevious,
    restorePreviousView,
    updateViewerContextWithVisibility,
    getViewerView,
    updateViewerVisibility,
    getViewerLoadInputParameter,
    loadByModelObjectInputParam,
    createVVIFileDynamic,
    createVVIFileStatic,
    setViewerOrientation,
    updateViewerToFit,
    setNavigationMode,
    toggleUseTransparency,
    toggleSingleMeasurementSubCommandsToolbar,
    toggleQuickMeasurementMode,
    setQuickMeasureFilter,
    openInVisulisationApplication
};
