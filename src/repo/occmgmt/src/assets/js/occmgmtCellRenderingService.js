// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtCellRenderingService
 */
import appCtxSvc from 'js/appCtxService';
import occmgmtPropertyIconRenderer from 'js/occmgmtPropertyIconRenderer';
import occmgmtVisibilitySvc from 'js/occmgmtVisibility.service';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import acePartialSelectionService from 'js/acePartialSelectionService';
import localeSvc from 'js/localeService';
import tableSvc from 'js/published/splmTablePublishedService';

var exports = {};
let resource = 'OccurrenceManagementMessages';
let localTextBundle = localeSvc.getLoadedText( resource );

/**
 * Wrapper function that internally routes the application on cell class processing
 * @param {Object} grid - Grid on which the cell class is to be updated
 * @param {Object} row - Table row that is holding the VMO
 * @param {Object} col - Column on which the cell class is to be applied
 * @param {Number} rowRenderIndex - Row rendering index
 * @param {Number} colRenderIndex - Column rendering index
 * @return {String} CSS name to apply on the cell
 */
export let gridCell = function( grid, row, col, rowRenderIndex, colRenderIndex ) {
    if( appCtxSvc.ctx.aceActiveContext.context.cellClass &&
        appCtxSvc.ctx.aceActiveContext.context.cellClass.gridCellClass ) {
        return appCtxSvc.ctx.aceActiveContext.context.cellClass.gridCellClass( grid, row, col, rowRenderIndex,
            colRenderIndex );
    }
};

/**
 * Add cell class for column definitions.
 * @param {Object} columnDefs - Column definitions on which cell class function is to be registered
 */
export let addCellClass = function( columnDefs ) {
    if( appCtxSvc.ctx.aceActiveContext.context.cellClass &&
        appCtxSvc.ctx.aceActiveContext.context.cellClass.gridCellClass ) {
        for( var index = 0; index < columnDefs.length; index++ ) {
            var column = columnDefs[ index ];
            column.cellClass = exports.gridCell;
        }
    }
};

/**
 * Adds/removes imageTooltip class to element.
 *
 * @param {DOMElement} element DOM element for classes
 * @param {Boolean} visibilityControls for adding/removing class
 */
var toggleVisibilityControls = function( vmo, element, visibilityControls ) {
    if( visibilityControls ) {
        element.classList.add( 'aw-occmgmt-cellImageTooltip' );
        element.title = localTextBundle.showHideTitle;
        element.setAttribute( 'role', 'button' );
        element.setAttribute( 'aria-pressed', vmo.visible );
        element.setAttribute( 'aria-label', vmo.displayName );
    } else {
        element.classList.remove( 'aw-occmgmt-cellImageTooltip' );
        element.title = '';
    }
};

/**
 * Adds/removes partialVisibility class to element.
 *
 * @param {DOMElement} element DOM element for classes
 * @param {Boolean} isVisible for adding/removing class
 */
var togglePartialVisibility = function( element, isVisible ) {
    if( !isVisible ) {
        element.classList.add( 'aw-widgets-partialVisibility' );
    } else {
        element.classList.remove( 'aw-widgets-partialVisibility' );
    }
};

/**
 * Table Command Cell Renderer for PL Table
 */
var _treeCmdCellRender = function() {
    var eventSubs = [];

    return {
        action: function( column, vmo, tableElem ) {
            var viewKey = column.contextKey; //contextStateMgmtService.getContextKeyFromParentScope( $( tableElem ).scope() );

            var cellContent = tableSvc.createTreeCellCommandElement( column, vmo, tableElem );

            // add event for cell image visibility
            var gridCellImageElement = cellContent.getElementsByClassName( tableSvc.CLASS_GRID_CELL_IMAGE )[ 0 ];
            if( gridCellImageElement && viewKey ) {
                var performCellToggle = function( event ) {
                    if( appCtxSvc.ctx[ viewKey ].visibilityControls ) {
                        event.stopPropagation();
                        occmgmtVisibilitySvc.toggleOccVisibility( cdm.getObject( vmo.uid ), viewKey );
                        gridCellImageElement.setAttribute( 'aria-pressed', vmo.visible );
                    }
                };

                gridCellImageElement.addEventListener( 'click', performCellToggle );

                toggleVisibilityControls( vmo, gridCellImageElement, appCtxSvc.ctx[ viewKey ].visibilityControls );
                togglePartialVisibility( gridCellImageElement, vmo.visible );
            }

            return cellContent;
        },
        condition: function( column ) {
            return column.isTreeNavigation === true;
        },
        name: 'treeCommandCellRenderer',
        destroy: function() {
            _.forEach( eventSubs, function( eventBusSub ) {
                if( eventBusSub !== null ) {
                    eventBus.unsubscribe( eventBusSub );
                }
            } );
        }
    };
};

var _rowMarkupRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        // No green line for tracked property changes in context of absolute occurrence
        var isPropChgAddCol = false;
        if( vmo.propChangeWithAdd === true ) {
            var absProps = vmo.props.awb0MarkupPropertyNames ? vmo.props.awb0MarkupPropertyNames.dbValues : undefined;
            if( absProps !== undefined && absProps.length > 0 && absProps.indexOf( column.field ) >= 0 ) {
                isPropChgAddCol = true;
            }
        }
        if( vmo.isAdded ) {
            if( isPropChgAddCol === false ) {
                cellContent.classList.add( 'aw-grid-markup-added' );
            }
        } else {
            //Control will come here if other condition met. No need to evaluate condition twice.
            cellContent.classList.add( 'aw-grid-markup-deleted' );
        }

        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isAdded || vmo.isDeleted && column.name !== 'Awb0ConditionalElement.awb0PendingAction';
    },
    name: 'rowMarkupRenderer'
};

var _staleElementRenderer = {
    action: function( column, vmo, tableElem ) {
        return tableSvc.createElement( column, vmo, tableElem );
    },
    condition: function( column, vmo ) {
        return vmo.isStale;
    },
    name: 'staleElementRenderer'
};

var _greyedOutElementRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );


        cellContent.classList.add( 'aw-widgets-partialVisibility' );

        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isGreyedOutElement || vmo.isPendingCut;
    },
    name: '_greyedOutElementRenderer'
};

var _overrideIconRenderer = {
    action: function( column, vmo, tableElem ) {
        var columnsToExcludeForCssProcessing = [ 'awb0Transform', 'awb0VariantFormula' ];
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        if( columnsToExcludeForCssProcessing.indexOf( column.propertyName ) === -1 ) {
            cellContent.classList.add( 'aw-occmgmtjs-overrideIcon' );
        }
        cellContent.classList.add( 'aw-occmgmt-iconMinWidth' );
        occmgmtPropertyIconRenderer.overriddenPropRenderer( vmo, cellContent, column.propertyName );
        return cellContent;
    },
    condition: function( column, vmo ) {
        if( vmo.props && vmo.props.awb0OverriddenProperties && vmo.props.awb0OverriddenProperties.dbValues.length > 0 &&
            vmo.props.awb0OverriddenProperties.dbValues.indexOf( column.propertyName ) !== -1 ) {
            return true;
        }
        return false;
    },
    name: '_overrideIconRenderer'
};

export let resetpropHighLightForCompare = function( columnDefs ) {
    var cellRenderersToReset = [ 'prophighlightRenderer' ];
    for( var index = 0; index < columnDefs.length; index++ ) {
        var column = columnDefs[ index ];
        _.forEach( cellRenderersToReset, function( renderer ) {
            _.remove( column.cellRenderers, function( cellRenderer ) {
                if( cellRenderer.name ) {
                    return cellRenderer.name === renderer;
                }
            } );
        } );
        if( appCtxSvc.ctx.cellClass &&
            appCtxSvc.ctx.cellClass.pltablePropRender ) {
            column.cellRenderers.splice( 0, 0, appCtxSvc.ctx.cellClass.pltablePropRender );
        }
    }
};
/**
 * Set cell template for column definitions
 * @param {Object} columnDefs - Column definitions on which cell class function is to be registered
 * @param {Object} cellRenderers -custom renderers
 */
export let setOccmgmtCellTemplate = function( columnDefs, cellRenderers, contextKey ) {
    for( var index = 0; index < columnDefs.length; index++ ) {
        var column = columnDefs[ index ];
        column.cellRenderers = [];
        column.contextKey = contextKey;
        if( appCtxSvc.ctx.customRendererForColumns ) {
            var renderers = Object.keys( appCtxSvc.ctx.customRendererForColumns ).reduce( function( result, key ) {
                return result.concat( appCtxSvc.ctx.customRendererForColumns[ key ] );
            }, [] );
            _.forEach( renderers, function( renderer ) {
                column.cellRenderers.push( renderer );
            } );
        }
        column.cellRenderers.push( _rowMarkupRenderer );
        column.cellRenderers.push( _staleElementRenderer );
        column.cellRenderers.push( _greyedOutElementRenderer );
        column.cellRenderers.push( acePartialSelectionService.partialSelectionRenderer );

        if( cellRenderers ) {
            _.forEach( cellRenderers, function( cellRenderer ) {
                if( column.cellRenderers.indexOf( cellRenderer ) === -1 ) { column.cellRenderers.push( cellRenderer ); }
            } );
        }

        if( appCtxSvc.ctx.cellClass &&
            appCtxSvc.ctx.cellClass.pltablePropRender ) {
            column.cellRenderers.push( appCtxSvc.ctx.cellClass.pltablePropRender );
        }

        if( column.isTreeNavigation ) {
            column.cellRenderers.push( _treeCmdCellRender() );
        }
        column.cellRenderers.push( _overrideIconRenderer );
    }
    if( appCtxSvc.ctx.customRendererForColumns ) {
        appCtxSvc.unRegisterCtx( 'customRendererForColumns' );
    }
};

/**
 * Table/Tree cell rendering service utility
 * @param {Object} appCtxSvc - appCtxService to use.
 * @returns {Object} - Object.
 */

export default exports = {
    gridCell,
    addCellClass,
    setOccmgmtCellTemplate,
    resetpropHighLightForCompare
};
