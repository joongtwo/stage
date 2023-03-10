//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Plugin to support autocomplete for WI Editor
 */
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';
import eventBus from 'js/eventBus';

const PARTS_TOOLS_POPUP_VIEW = 'PartsToolsSearchList';
const STANDARD_TEXT_POPUP_VIEW = 'StandardTextSearchList';
const VISUALS_POPUP_VIEW = 'VisualsSearchList';
const AUTOCOMPLETE_MARKER = 'wiAutocomplete';

let viewTobeLoaded = '';


export default class WIAutocomplete extends ckeditor5ServiceInstance.Plugin {
    init() {
        this.addTextWatcher();
    }

    addTextWatcher() {
        const editor = this.editor;
        const watcher = new ckeditor5ServiceInstance.TextWatcher( editor.model, function( text ) {
            let match = false;
            //Regex for character '[[' to show search popup for parts and tools
            const regExpForAutocompletePartsTools = new RegExp( /\[{2}(?!.)(?!(\w|\s))/ );
            //Regex for character '\\' to show search popup for standard text
            const regExpForAutocompleteStandardText = new RegExp( /\\{2}(?!.)(?!(\w|\s))/ );
            //Regex for character '{{' to show search popup for visuals
            const regExpForAutocompleteVisuals = new RegExp( /\{{2}(?!.)(?!(\w|\s))/ );
            if( regExpForAutocompletePartsTools.test( text ) ) {
                match = true;
                viewTobeLoaded = PARTS_TOOLS_POPUP_VIEW;
            } else if( regExpForAutocompleteStandardText.test( text ) ) {
                match = true;
                viewTobeLoaded = STANDARD_TEXT_POPUP_VIEW;
            }else if( regExpForAutocompleteVisuals.test( text ) ) {
                match = true;
                viewTobeLoaded = VISUALS_POPUP_VIEW;
            }
            return match;
        } );

        watcher.on( 'matched', ( evt, data ) => {
            const selection = editor.model.document.selection;
            const focus = selection.focus;
            const start = focus.getShiftedBy( -3 );
            const end = focus.getShiftedBy( -1 );
            const editing = editor.editing;
            const domConverter = editing.view.domConverter;
            const mapper = editing.mapper;
            const markerRange = editor.model.createRange( start, end );
            if ( editor.model.markers.has( AUTOCOMPLETE_MARKER ) ) {
                const marker = editor.model.markers.get( AUTOCOMPLETE_MARKER );
                editor.model.change( writer => {
                    writer.updateMarker( marker, { range: markerRange } );
                } );
            } else {
                editor.model.change( writer => {
                    writer.addMarker( AUTOCOMPLETE_MARKER, { range: markerRange, usingOperation: false, affectsData: false } );
                } );
            }
            const marker = this.editor.model.markers.get( AUTOCOMPLETE_MARKER );
            let modelRange = marker.getRange();
            const viewRange = mapper.toViewRange( modelRange );
            const rangeRects =  ckeditor5ServiceInstance.Rect.getDomRangeRects( domConverter.viewRangeToDom( viewRange ) );

            let eventData = {
                viewTobeLoaded : viewTobeLoaded,
                popupOffset : {
                    top: rangeRects[0].top + 16,
                    left: rangeRects[0].left + 10
                }
            };
            eventBus.publish( 'wi.openAutoPredictPopup', eventData );
            this.editor.model.change( writer => writer.removeMarker( AUTOCOMPLETE_MARKER ) );
        } );

        return watcher;
    }
}


