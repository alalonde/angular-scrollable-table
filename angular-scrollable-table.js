(function (angular) {
    'use strict';

    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    angular.module('scrollable-table', [])
        .directive('scrollableTable', ['$timeout', '$q', '$parse', function ($timeout, $q, $parse) {
            return {
                transclude: true,
                restrict: 'E',
                scope: {
                    tableHeight: '=?',
                    tableWidth: '=?',
                    showFilters: '=?',
                    columnWidths: '=?'
                },
                template:
                '<div class="scrollableContainer" ' +
                'ng-style=' +
                '"' +
                '{height: tableHeight, width: tableWidth}' +
                '"' +
                '>' +
                '<div class="headerSpacer"></div>' +
                '<div class="scrollArea" ng-transclude></div>' +
                '</div>',
                controller: ['$scope', '$element', '$attrs', function ($scope, $element) {
                    this.getTableElement = function (){
                        return $element;
                    };

                    $scope.tableHeight = angular.isDefined($scope.tableHeight) ? $scope.tableHeight : 'auto';
                    $scope.tableWidth = angular.isDefined($scope.tableWidth) ? $scope.tableWidth : 'auto';
                    $scope.showFilters = angular.isDefined($scope.showFilters) ? $scope.showFilters : false;

                    // Set fixed widths for the table headers in case the text overflows.
                    // There's no callback for when rendering is complete, so check the visibility of the table
                    // periodically -- see http://stackoverflow.com/questions/11125078
                    function waitForRender() {
                        var deferredRender = $q.defer();
                        function wait() {
                            if ($element.find("table:visible").length === 0) {
                                $timeout(wait, 100);
                            } else {
                                deferredRender.resolve();
                            }
                        }

                        $timeout(wait);
                        return deferredRender.promise;
                    }

                    var tableElement;
                    function getTable(){
                        if(typeof(tableElement) === 'undefined')
                            tableElement = $element.find('.scrollArea table')[0];
                        return tableElement;
                    }
                    var headerRow,
                        filterRow;
                    function getHeaderRow() {
                        if(typeof(headerRow) === 'undefined')
                            headerRow = $element.find("table th .th-inner-header:visible");
                        return headerRow;
                    }
                    function getFilterRow() {
                        if(typeof(filterRow) === 'undefined')
                            filterRow = $element.find("table th .th-inner:visible");
                        return filterRow;
                    }
                    var headersAreFixed = $q.defer();
                    function fixHeaderWidths() {
                        let table = getTable();
                        if($scope.tableHeight === 'auto')
                            table.style.overflowY = 'hidden';

                        if(table.style.tableLayout === '') {
                            //wraps header rows in divs for width resizing
                            if (!$element.find(".header .th-inner-header").length) {
                                $element.find(".header").wrapInner('<div class="th-inner-header"></div>');
                                $element.find(".header .th-inner-header:not(:has(.box))").wrapInner('<div class="box"></div>');
                            }
                            if (!$element.find(".filter .th-inner").length) {
                                $element.find(".filter").wrapInner('<div class="th-inner pt-1 px-1"></div>');
                                $element.find(".filter .th-inner:not(:has(.box))").wrapInner('<div class="box"></div>');
                            }
                        }

                        let headerRow = getHeaderRow(),
                            filterRow = getFilterRow(),
                            filtersShown = filterRow.length > 0,
                            hasColWidths = angular.isDefined($scope.columnWidths),
                            hasScrollbar = $element.find(".scrollArea").height() < table.offsetHeight;

                        table.style.tableLayout = 'auto';

                        for(let i=0; i< headerRow.length; i++) {
                            let el = headerRow[i],
                                filterEl = filtersShown ? filterRow[i] : undefined;
                            if(!hasColWidths || $scope.columnWidths[i] === 0) {
                                let width = el.parentElement.getBoundingClientRect().width;
                                //if there are no column widths or the width = 0 then the column is autosized
                                table.style.tableLayout = 'auto';

                                if (i === (headerRow.length-1) && hasScrollbar){
                                    let scrollbarWidth = $element.find(".scrollArea").width() - $element.find("tbody tr").width();
                                    width = Math.max(scrollbarWidth + width, width);
                                }
                                el.style.width = width + 'px';
                                //the auto here is to manage the case where someone sets a bad/small column width
                                //without this logic the columns overflow and mess up the whole table
                                el.parentElement.style.width = 'auto';
                                if(typeof(filterEl) !== 'undefined') {
                                    filterEl.style.width = width + 'px';
                                    filterEl.parentElement.style.width = 'auto';
                                }
                            }else {
                                //if there is a non-zero value for column width it is set in a fixed fashion
                                table.style.tableLayout = 'fixed';
                                let width = $scope.columnWidths[i];

                                el.style.width = width + 'px';
                                el.parentElement.style.width = width + 'px';

                                if(typeof(filterEl) !== 'undefined') {
                                    filterEl.style.width = width + 'px';
                                    filterEl.parentElement.style.width = width + 'px';
                                }
                            }
                        }
                        table.style.tableLayout = 'fixed';

                        //this loop cleans up any auto header widths and sets them to their actual width
                        for(let i=0; i< headerRow.length; i++) {
                            if(hasColWidths && $scope.columnWidths[i] !== 0)
                                continue;
                            let el = headerRow[i],
                                width = el.parentElement.getBoundingClientRect().width,
                                filterEl = filtersShown ? filterRow[i] : undefined;

                            width = Math.max(el.getBoundingClientRect().width, width);
                            if (i === (headerRow.length-1) && hasScrollbar){
                                let scrollbarWidth = $element.find(".scrollArea").width() - $element.find("tbody tr").width();
                                width = Math.max(scrollbarWidth + width, width);
                            }
                            el.style.width = width + 'px';
                            el.parentElement.style.width = width + 'px';
                            if(typeof(filterEl) !== 'undefined') {
                                filterEl.style.width = width + 'px';
                                filterEl.parentElement.style.width = width + 'px';
                            }
                        }

                        headersAreFixed.resolve();
                    }

                    function debounce(func, wait, immediate) {
                        var timeout;
                        return function() {
                            var context = this, args = arguments;
                            var later = function() {
                                timeout = null;
                                if (!immediate) func.apply(context, args);
                            };
                            var callNow = immediate && !timeout;
                            clearTimeout(timeout);
                            timeout = setTimeout(later, wait);
                            if (callNow) func.apply(context, args);
                        };
                    };
                    var headerResizeDebounce = debounce(fixHeaderWidths, 500);
                    $element.find(".scrollArea").scroll(function (event) {
                        var IEWasAMistake = event.target.scrollLeft,
                            headerElement = !isFirefox ? getHeaderRow() : $element.find('thead'),
                            vertScrollOnly = (parseInt(headerElement.css('margin-left'),10) + IEWasAMistake) === 0;

                        if(vertScrollOnly){
                            headerResizeDebounce();
                        }
                        if(!isFirefox) {
                            getFilterRow().css('margin-left', 0 - IEWasAMistake);
                        }
                        headerElement.css('margin-left', 0 - IEWasAMistake);

                    });

                    var first = true;
                    angular.element(window).on('resize', function(){
                        if(!first){
                            headerResizeDebounce();
                            return;
                        }
                        $timeout(function(){
                            $scope.$apply();
                        });
                        first = false;
                    });

                    $scope.$watch(function(){
                        if(first) {
                            //sets the header row(s) sizes
                            let paddingTop = 86,
                                height = 88;
                            if(!$scope.showFilters) {
                                height = 32;
                                paddingTop = 30;
                                $element.find(".scrollArea table .th-inner-header").css('height', height + 'px');
                            }
                            $element.find(".scrollableContainer").css('padding-top', paddingTop + 'px');
                            $element.find(".scrollableContainer .headerSpacer").css('height', height + 'px');
                        }
                        return $element.find('.scrollArea').width();
                    }, function(newWidth, oldWidth){
                        if(newWidth * oldWidth <= 0){
                            return;
                        }
                        renderChains();
                    });
                    function renderChains(){
                        waitForRender().then(fixHeaderWidths);
                    }
                }]
            };
        }]);

    function _getScale(sizeCss){
        return parseInt(sizeCss.replace(/px|%/, ''), 10);
    }
})(angular);
