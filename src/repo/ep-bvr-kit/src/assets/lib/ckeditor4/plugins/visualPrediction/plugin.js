/**
 * @fileOverview The "visualPrediction" plugin.
 * This plugin is used to add prediction text to work instructions editor.
 */
'use strict';

( function() {
    CKEDITOR.plugins.add( 'visualPrediction', {

        onLoad: function() {
            //TODO: Add CSS from here
        },

        init: function( editor ) {
            CKEDITOR.document.appendStyleSheet( this.path + 'visualPrediction.css' );

            var PLACEHOLDERS = window.parent.getVisualsList ? window.parent.getVisualsList() : null;

            /*
             * getVisualsList will display the list of parts and tools available
             */
            var getVisualsList = '<li data-id="{id}"><span>{name}</span></li>';

            /*
             * selectedVisual will display the selected visual form the list
             */
            var selectedVisual = '{{{name}}}<span>&nbsp;</span>';

            /*
             * matchKeyboardShortcut is initiated everytime the key is pressed and match the pattern of the text
             */
            function matchKeyboardShortcut( range ) {
                if( !range.collapsed ) {
                    return null;
                }
                return CKEDITOR.plugins.textMatch.match( range, matchCallback );
            }

            function matchCallback( text, offset ) {

                var pattern = /\{{2}(\w|\s)*(?!.*\{{2}(\w|\s)*)/,
                    match = text.slice( 0, offset )
                    .match( pattern );

                if( !match ) {
                    return null;
                }

                return {
                    start: match.index,
                    end: offset
                };
            }

            /*
             * filterListByText will filter out the List of Visuals by Text matched
             */
            function filterListByText( matchInfo, callback ) {

                PLACEHOLDERS = window.parent.getVisualsList ? window.parent.getVisualsList() : null;
                if( PLACEHOLDERS ) {
                    matchInfo.query = matchInfo.query.substr( 2 );
                    var data = PLACEHOLDERS.filter( function( item ) {
                        var itemName = item.name.toLowerCase();
                        return itemName.indexOf( matchInfo.query.toLowerCase() ) > -1;
                    } );
                }

                callback( data );
            }

            var autocomplete = new CKEDITOR.plugins.autocomplete( editor, {
                textTestCallback: matchKeyboardShortcut,
                dataCallback: filterListByText,
                itemTemplate: getVisualsList,
                outputTemplate: selectedVisual
            } );

            // Override default getHtmlToInsert to enable rich content output.
            autocomplete.getHtmlToInsert = function( item ) {
                this.outputTemplate.source = selectedVisual;
                this.outputTemplate.source = this.outputTemplate.source.replace( /{name}/g, item.name );
                return this.outputTemplate.output( item );
            };
        }
    } );
} )();
