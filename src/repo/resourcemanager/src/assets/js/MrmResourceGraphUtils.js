// Copyright (c) 2022 Siemens

/**
 * @module js/MrmResourceGraphUtils
 */
import appCtxSvc from 'js/appCtxService';
import templateService from 'js/MrmResourceGraphTemplateService';
import localeService from 'js/localeService';
import _ from 'lodash';

var exports = {};

/**
 * It sets graph node add commands transformation based on current width and height of a given node,
 * so that commands will be placed at center irrespective to width and height of the node.
 * @param {Object} graphModel - the graph model object
 * @param {Object} graphNode - the graph node
 * @param {boolean} isStructureModifiable - true if struture is modifiable
 */
export let setGraphNodeAddCommandsTransformation = function( graphModel, graphNode, isStructureModifiable ) {
    //If structure is modifiable then only need to change transformation of the add commands.
    if ( isStructureModifiable ) {
        var currectLayoutOption = graphModel.config.layout.defaultOption;

        var centerOfNodeWidth = graphNode.getWidth() / 2 - 11;
        var nodeHeight = graphNode.getHeight() - 22;

        var graphControl = graphModel.graphControl;
        var groupGraph = graphControl.groupGraph;

        if ( groupGraph && groupGraph.isGroup( graphNode ) && graphNode.viewState.collapsedSize ) {
            nodeHeight = graphNode.viewState.collapsedSize.height - 22;
        }

        var mrm0AddUpDirectionElements = document.querySelectorAll( '[id=\'MRM0AddUpDirectionElements\']' );
        var mrm0AddDownDirectionElements = document.querySelectorAll( '[id=\'MRM0AddDownDirectionElements\']' );

        //Based on current layout option, add commands are placed accordingly inside the node
        switch ( currectLayoutOption ) {
            case 'TopToBottom':
            case 'Incremental':
            case 'Organic':
                for ( var i = 0; i < mrm0AddUpDirectionElements.length; i++ ) {
                    mrm0AddUpDirectionElements[i].setAttribute( 'transform', 'translate(' + centerOfNodeWidth + ' ' + 0 + ')' );
                }

                for ( var i = 0; i < mrm0AddDownDirectionElements.length; i++ ) {
                    mrm0AddDownDirectionElements[i].setAttribute( 'transform', 'translate(' + centerOfNodeWidth + ' ' + nodeHeight + ')' );
                }

                break;
            case 'BottomToTop':
                for ( var i = 0; i < mrm0AddUpDirectionElements.length; i++ ) {
                    mrm0AddUpDirectionElements[i].setAttribute( 'transform', 'translate(' + centerOfNodeWidth + ' ' + nodeHeight + ')' );
                }

                for ( var i = 0; i < mrm0AddDownDirectionElements.length; i++ ) {
                    mrm0AddDownDirectionElements[i].setAttribute( 'transform', 'translate(' + centerOfNodeWidth + ' ' + 0 + ')' );
                }
                break;
            case 'LeftToRight':
                for ( var i = 0; i < mrm0AddUpDirectionElements.length; i++ ) {
                    mrm0AddUpDirectionElements[i].setAttribute( 'transform', 'translate(' + 10 + ' ' + nodeHeight / 2 + ')' );
                }

                for ( var i = 0; i < mrm0AddDownDirectionElements.length; i++ ) {
                    mrm0AddDownDirectionElements[i].setAttribute( 'transform', 'translate(' + centerOfNodeWidth * 2 + ' ' + nodeHeight / 2 + ')' );
                }

                break;
            case 'RightToLeft':
                for ( var i = 0; i < mrm0AddUpDirectionElements.length; i++ ) {
                    mrm0AddUpDirectionElements[i].setAttribute( 'transform', 'translate(' + centerOfNodeWidth * 2 + ' ' + nodeHeight / 2 + ')' );
                }

                for ( var i = 0; i < mrm0AddDownDirectionElements.length; i++ ) {
                    mrm0AddDownDirectionElements[i].setAttribute( 'transform', 'translate(' + 10 + ' ' + nodeHeight / 2 + ')' );
                }

                break;
            default:
                break;
        }
    }
};

/**
 * It shows graph node's add commands at a selected node and hide from other nodes.
 * @param {Object} graphModel - the graph model object.
 * @param {boolean} isStructureModifiable - true if struture is modifiable
 */
export let showHideAddCommandsOnSelection = function( graphModel, isStructureModifiable ) {
    var graphControl = graphModel.graphControl;
    if ( graphControl ) {
        var resourceGraphNodes = graphModel.nodeMap;
        var graphNode;
        var bindData;
        var selectedGraphItems = graphControl.getSelected();

        if ( selectedGraphItems.length === 1 && selectedGraphItems[0].getItemType() === 'Node' ) {
            showHideNodeAddCommands( graphModel, selectedGraphItems[0], isStructureModifiable );
        } else {
            //If a single node is not selected then hide node add commands from all the nodes
            _.forEach( resourceGraphNodes, function( value, key ) {
                graphNode = resourceGraphNodes[key];
                bindData = templateService.getBindProperties( graphNode.appData.nodeObject );
                bindData.show_addupdirectioncomponents_command = false;
                bindData.show_adddowndirectioncomponents_command = false;
                graphControl.graph.updateNodeBinding( graphNode, bindData );
            } );
        }
    }
};

/**
 * It shows graph node's add commands at a node on which mouse hovered in and hide from other nodes
 * @param {Object} graphModel - the graph model object
 * @param {Object} node - the graph node
 * @param {boolean} isHovered - it tracks whether is hovered in/out
 * @param {boolean} isStructureModifiable - true if struture is modifiable
 *  */
export let showHideAddCommandsOnMouseHovered = function( graphModel, node, isHovered, isStructureModifiable ) {
    var graphControl = graphModel.graphControl;
    if ( !isHovered ) {
        var node;
        var selectedGraphItems = graphControl.getSelected();
        if ( selectedGraphItems.length === 1 && selectedGraphItems[0].getItemType() === 'Node' ) {
            node = selectedGraphItems[0];
        }
    }

    showHideNodeAddCommands( graphModel, node, isStructureModifiable );
};

/**
 * It selects underline graph node if any one of node's add command clicked
 * @param {Object} graphModel - the graph model object
 * @param {String} selectUid - Uid of the node to be select
 */
export let selectResourceGraphCommandContextItem = function( graphModel, selectUid ) {
    var selectedGraphItems = graphModel.graphControl.getSelected();
    var graphControl = graphModel.graphControl;
    if ( selectedGraphItems.length === 1 && selectedGraphItems[0].getItemType() === 'Node' ) {
        var alreadySelectedNodeUid = selectedGraphItems[0].appData.nodeObject.uid;
        if ( alreadySelectedNodeUid === selectUid ) {
            //Already selected a node with given uid
            return;
        }
    }

    //Clear previous selected graph items before selecting given node.
    graphControl.setSelected( null, false, false );

    //Select a node with given uid
    var selectResourceGraphNodes = [];
    var selectResourceGraphNode = graphModel.nodeMap[selectUid];
    selectResourceGraphNodes.push( selectResourceGraphNode );
    graphControl.setSelected( selectResourceGraphNodes, true, false );
};

/**
 * It shows node add commands on a given graph node and hide from other graph nodes
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} node - the graph node on add commands show/hide
 * @param {boolean} isStructureModifiable - true if struture is modifiable
 */
function showHideNodeAddCommands( graphModel, node, isStructureModifiable ) {
    var resourceGraphNodes = graphModel.nodeMap;
    var graphControl = graphModel.graphControl;
    var currentGraphNode;
    var bindData;
    var topElement = appCtxSvc.ctx.occmgmtContext.topElement;

    var topNodeUID;
    if ( topElement ) {
        topNodeUID = topElement.uid;
    }

    var graphNodeObject;
    var nodeParentUid;
    var isSubAssemblyNode;
    var isPackedNode;
    if ( node ) {
        graphNodeObject = node.appData.nodeObject;
        if ( graphNodeObject.props ) {
            nodeParentUid = graphNodeObject.props.awb0Parent.dbValues[0];
            isSubAssemblyNode = nodeParentUid !== null && topNodeUID !== nodeParentUid;
            if ( graphNodeObject.props.awb0IsPacked ) {
                isPackedNode = graphNodeObject.props.awb0IsPacked.dbValues[0] === '1';
            }
        }
    }
    _.forEach( resourceGraphNodes, function( value, key ) {
        currentGraphNode = resourceGraphNodes[key];
        bindData = templateService.getBindProperties( currentGraphNode.appData.nodeObject );
        bindData.show_addupdirectioncomponents_command = false;
        bindData.show_adddowndirectioncomponents_command = false;
        if ( isStructureModifiable && node && graphNodeObject.uid === currentGraphNode.appData.nodeObject.uid && !isSubAssemblyNode && !isPackedNode ) {
            if ( topNodeUID !== graphNodeObject.uid ) {
                bindData.show_addupdirectioncomponents_command = true;
            }

            bindData.show_adddowndirectioncomponents_command = true;
            setGraphNodeAddCommandsTransformation( graphModel, node, isStructureModifiable );
        }

        graphControl.graph.updateNodeBinding( currentGraphNode, bindData );
    } );
}

/**
 * Get the message for given key from mrm resource file, replace the parameter and return the localized string
 *
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
export let getMRMGraphLocalizedMessage = function( resourceKey, messageParam ) {
    var localizedValue = null;
    var resource = 'mrmMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    if ( localTextBundle ) {
        localizedValue = localTextBundle[resourceKey].replace( '{0}', messageParam );
    } else {
        var asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[resourceKey].replace( '{0}', messageParam );
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }
    return localizedValue;
};

/**
 * Gets the current data provider. If access mode is resource.
 * @param {*} dataProviders
 */
export var getCurrentResourceDataProvider = function( dataProviders ) {
    for ( var dp in dataProviders ) {
        var dpAccessMode = dataProviders[dp].json.inputData.accessMode;
        if ( dpAccessMode === 'resource' ) {
            return dataProviders[dp];
        }
    }
    return;
};

/**
 * It clears the resource view specific context data from "occmgmtContext"
 * @param {String} contextKey
 */
export var clearResourceViewData = function( contextKey ) {
    const currentOccMgmtContext = appCtxSvc.getCtx( contextKey );
    let newOccMgmtContext = { ...currentOccMgmtContext };

    if( newOccMgmtContext.resourceLoadResult ) {
        delete newOccMgmtContext.resourceLoadResult;
    }

    if( newOccMgmtContext.resourceDataCtxNode ) {
        delete newOccMgmtContext.resourceDataCtxNode;
    }

    if( newOccMgmtContext.isStructureModifiable ) {
        delete newOccMgmtContext.isStructureModifiable;
    }

    appCtxSvc.updateCtx( contextKey, newOccMgmtContext );
    return;
};

/**
 * It checks if structure is modifiable,  set the information on occurence management context.
 * @param {boolean} isStructureModifiable, true if structure is modifaible
 * @returns {Integer} true if structure is modifaible, otherwise false.
 */
export let checkStructureModifiable = function( response ) {
    let structureModifiable = false;
    if ( response && response.visibleCommandsInfo ) {
        let commands = response.visibleCommandsInfo;
        for ( let index = 0; index < commands.length; index++ ) {
            if ( commands[index].commandId === 'Awb0AddChildElement' || commands[index].commandId === 'Awb0RemoveElement' ) {
                structureModifiable = true;
                break;
            }
        }
    }

    return structureModifiable;
};

export default exports = {
    setGraphNodeAddCommandsTransformation,
    showHideAddCommandsOnSelection,
    showHideAddCommandsOnMouseHovered,
    selectResourceGraphCommandContextItem,
    getMRMGraphLocalizedMessage,
    getCurrentResourceDataProvider,
    clearResourceViewData,
    checkStructureModifiable
};
