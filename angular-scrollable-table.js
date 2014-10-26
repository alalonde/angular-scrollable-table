(function (angular) {
    'use strict';
    angular.module('scrollable-table', [])
        .directive('scrollableTable', ['$timeout', '$q', '$parse', function ($timeout, $q, $parse) {
            return {
                transclude: true,
                restrict: 'E',
                scope: {
                    rows: '=watch',
                    sortFn: '='
                },
                template: '<div class="scrollableContainer">' +
                    '<div class="headerSpacer"></div>' +
                    '<div class="scrollArea" ng-transclude></div>' +
                    '</div>',
                controller: ['$scope', '$element', '$attrs', function ($scope, $element, $attrs) {
                    // define an API for child directives to view and modify sorting parameters
                    this.getSortExpr = function () {
                        return $scope.sortExpr;
                    };
                    this.isAsc = function () {
                        return $scope.asc;
                    };
                    this.setSortExpr = function (exp) {
                        $scope.asc = true;
                        $scope.sortExpr = exp;
                    };
                    this.toggleSort = function () {
                        $scope.asc = !$scope.asc;
                    };

                    this.doSort = function (comparatorFn) {
                        if (comparatorFn) {
                            $scope.rows.sort(function (r1, r2) {
                                var compared = comparatorFn(r1, r2);
                                return $scope.asc ? compared : compared * -1;
                            });
                        } else {
                            $scope.rows.sort(function (r1, r2) {
                                var compared = defaultCompare(r1, r2);
                                return $scope.asc ? compared : compared * -1;
                            });
                        }
                    };

                    this.reRenderHeader = function (){
                        return waitForRender().then(fixHeaderWidths);
                    };

                    this.getTableElement = function (){
                        return $element;
                    };

                    /**
                     * append handle function to execute after table header resize.
                     */
                    this.appendTableResizingHandler = function (handler){
                        var handlerSequence = $scope.headerResizeHanlers || [];
                        for(var i = 0;i < handlerSequence.length;i++){
                            if(handlerSequence[i].name === handler.name){
                                return;
                            }
                        }
                        handlerSequence.push(handler);
                        $scope.headerResizeHanlers = handlerSequence;
                    };

                    function defaultCompare(row1, row2) {
                        var exprParts = $scope.sortExpr.match(/(.+)\s+as\s+(.+)/);
                        var scope = {};
                        scope[exprParts[1]] = row1;
                        var x = $parse(exprParts[2])(scope);

                        scope[exprParts[1]] = row2;
                        var y = $parse(exprParts[2])(scope);

                        if (x === y) return 0;
                        return x > y ? 1 : -1;
                    }

                    function scrollToRow(row) {
                        var offset = $element.find(".headerSpacer").height();
                        var currentScrollTop = $element.find(".scrollArea").scrollTop();
                        $element.find(".scrollArea").scrollTop(currentScrollTop + row.position().top - offset);
                    }

                    $scope.$on('rowSelected', function (event, rowId) {
                        var row = $element.find(".scrollArea table tr[row-id='" + rowId + "']");
                        if (row.length === 1) {
                            // Ensure that the headers have been fixed before scrolling, to ensure accurate
                            // position calculations
                            $q.all([waitForRender(), headersAreFixed.promise]).then(function () {
                                scrollToRow(row);
                            });
                        }
                    });

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

                    var headersAreFixed = $q.defer();

                    function fixHeaderWidths() {
                        if (!$element.find("thead th .th-inner").length)
                            $element.find("thead th").wrapInner('<div class="th-inner"></div>');

                        $element.find("table th .th-inner").each(function (index, el) {
                            el = angular.element(el);
                            var width = el.parent().width(),
                                lastCol = $element.find("table th:visible:last"),// if it's the last header, add space for the scrollbar equivalent unless it's centered
                                headerWidth = width;
                            if (lastCol.css("text-align") !== "center") {
                                var hasScrollbar = $element.find(".scrollArea").height() < $element.find("table").height();
                                if (lastCol[0] == el.parent()[0] && hasScrollbar) {
                                    headerWidth += $element.find(".scrollArea").width() - $element.find("tbody tr").width();
                                    headerWidth = Math.max(headerWidth, width);
                                }
                            }
                            var minWidth = _getScale(el.parent().css('min-width')),
                                title = el.parent().attr("title");
                            headerWidth = Math.max(minWidth, headerWidth);
                            el.css("width", headerWidth);
                            if (!title) {
                                title = el.children().length ? el.find(".title .ng-scope").html() : el.html();
                            }
                            el.attr("title", title.trim());
                        });
                        headersAreFixed.resolve();
                    }

                    // when the data model changes, fix the header widths.  See the comments here:
                    // http://docs.angularjs.org/api/ng.$timeout
                    $scope.$watch('rows', function (newValue, oldValue) {
                        if (newValue) {
                            waitForRender().then(fixHeaderWidths);
                            // clean sort status and scroll to top of table once records replaced.
                            $scope.sortExpr = null;
                            $element.find('.scrollArea').scrollTop(0);
                        }
                    });

                    $scope.asc = !$attrs.hasOwnProperty("desc");
                    $scope.sortAttr = $attrs.sortAttr;

                    $element.find(".scrollArea").scroll(function (event) {
                        $element.find("thead th .th-inner").css('margin-left', 0 - event.target.scrollLeft);
                    });

                    angular.element(window).on('resize', function(){
                        $scope.$apply();
                    });
                    $scope.$watch(function(){
                        return $element.find('.scrollArea').width();
                    }, function(newWidth, oldWidth){
                        var _containerWidth = newWidth,
                            _containerOldWidth = oldWidth;
                        if(_containerWidth * _containerOldWidth == 0){
                            return;
                        }
                        var resizeQueue = waitForRender().then(fixHeaderWidths).then(function(){
                                return {
                                    newWidth: _containerWidth,
                                    previousWidth: _containerOldWidth
                                };
                            }),
                            customHandlers = $scope.headerResizeHanlers || [];
                        for(var i = 0;i < customHandlers.length;i++){
                            resizeQueue = resizeQueue.then(customHandlers[i]);
                        }
                    });
                }]
            };
        }])
        .directive('sortableHeader', [function () {
            return {
                priority: 100,
                transclude: true,
                scope: true,
                require: '^scrollableTable',
                template:
                    '<div class="box">' +   //the box element should be the parent of both sortable and resizable.
                        '<div ng-mouseenter="enter()" ng-mouseleave="leave()">' +
                            '<div class="title" ng-transclude></div>' +
                            '<span class="orderWrapper">' +
                                '<span class="order" ng-show="focused || isActive()" ng-click="toggleSort($event)" ng-class="{active:isActive()}">' +
                                    '<i ng-show="isAscending()" class="glyphicon glyphicon-chevron-up"></i>' +
                                    '<i ng-show="!isAscending()" class="glyphicon glyphicon-chevron-down"></i>' +
                                '</span>' +
                            '</span>' +
                        '</div>' +
                    '</div>',
                link: function (scope, elm, attrs, tableController) {
                    var expr = attrs.on || "a as a." + attrs.col;
                    scope.element = angular.element(elm);
                    scope.isActive = function () {
                        return tableController.getSortExpr() === expr;
                    };
                    scope.toggleSort = function (e) {
                        if (scope.isActive()) {
                            tableController.toggleSort();
                        } else {
                            tableController.setSortExpr(expr);
                        }
                        tableController.doSort(scope[attrs.comparatorFn]);
                        e.preventDefault();
                    };
                    scope.isAscending = function () {
                        if (scope.focused && !scope.isActive()) {
                            return true;
                        } else {
                            return tableController.isAsc();
                        }
                    };

                    scope.enter = function () {
                        scope.focused = true;
                    };
                    scope.leave = function () {
                        scope.focused = false;
                    };
                }
            };
        }])
        .directive('resizable', ['$q',function($q){
            return {
                restrict: 'A',
                scope: true,
                require: '^scrollableTable',
                compile: function compile(tElement, tAttrs, transclude) {
                    tElement.find('.box').append('<div class="resize-rod" ng-mousedown="resizing($event)"></div>');

                    return function postLink(scope, elm, attrs, tableController){
                        initRodPos();
                        tableController.appendTableResizingHandler(function relayoutHeaders(tableBox){
                            var tableElement = tableController.getTableElement().find('.scrollArea table');
                            if(tableElement.css('table-layout') === 'auto'){
                                initRodPos();
                            }else{
                                _resetColumnsSize(tableBox.newWidth, tableBox.previousWidth);
                            }
                            return tableBox;
                        });

                        scope.resizing = function(e){
                            var startPoint = _getScale(scope.element.children().css('left')) + scope.element.children().width(),
                                movingPos = e.pageX,
                                _document = angular.element(document),
                                _body = angular.element('body'),
                                coverPanel = angular.element('.scrollableContainer .resizing-cover'),
                                scaler = angular.element('<div class="scaler">');

                            _body.addClass('scrollable-resizing');
                            coverPanel.addClass('active');
                            angular.element('.scrollableContainer').append(scaler);
                            scaler.css('left', startPoint);

                            _document.bind('mousemove', function (e){
                                var offsetX = e.pageX - movingPos,
                                    movedOffset = _getScale(scaler.css('left')) - startPoint,
                                    widthOfActiveCol = scope.element.width(),
                                    minWidthOfActiveCol = _getScale(scope.element.css('min-width')),
                                    widthOfNextColOfActive = scope.element.next().width(),
                                    minWidthOfNextColOfActive = _getScale(scope.element.next().css('min-width'));
                                movingPos = e.pageX;
                                e.preventDefault();
                                if((offsetX > 0 && widthOfNextColOfActive - movedOffset <= minWidthOfNextColOfActive)
                                    || (offsetX < 0 && widthOfActiveCol + movedOffset <= minWidthOfActiveCol)){
                                    //stopping resize if user trying to extension and the active/next column already minimised.
                                    return;
                                }
                                scaler.css('left', _getScale(scaler.css('left')) + offsetX);
                            });
                            _document.bind('mouseup', function (e) {
                                e.preventDefault();
                                scaler.remove();
                                _body.removeClass('scrollable-resizing');
                                coverPanel.removeClass('active');
                                _document.unbind('mousemove');
                                _document.unbind('mouseup');

                                var offsetX = _getScale(scaler.css('left')) - startPoint,
                                    newWidth = scope.element.width(),
                                    minWidth = _getScale(scope.element.css('min-width')),
                                    widthOfNextColOfActive = scope.element.next().width(),
                                    minWidthOfNextColOfActive = _getScale(scope.element.next().css('min-width')),
                                    tableElement = tableController.getTableElement().find('.scrollArea table');

                                //hold original width of cells, to display cells as their original width after turn table-layout to fixed.
                                if(tableElement.css('table-layout') === 'auto'){
                                    tableElement.find("th .th-inner").each(function (index, el) {
                                        el = angular.element(el);
                                        var width = el.parent().width();
                                        el.parent().css('width', width);
                                    });
                                }

                                tableElement.css('table-layout', 'fixed');

                                if(offsetX > 0 && widthOfNextColOfActive - offsetX <= minWidthOfNextColOfActive){
                                    offsetX = widthOfNextColOfActive - minWidthOfNextColOfActive;
                                }
                                scope.element.next().removeAttr('style');
                                newWidth += offsetX;
                                scope.element.css('width', Math.max(minWidth, newWidth));
                                scope.element.next().css('width', widthOfNextColOfActive - offsetX);
                                resizeHeaderWidth();
                            });
                        };

                        function initRodPos(){
                            return tableController.reRenderHeader().then(function(){
                                var tableElement = tableController.getTableElement();
                                var headerPos = 1;//  1 is the width of right border;
                                tableElement.find("table th .th-inner").each(function (index, el) {
                                    el = angular.element(el);
                                    var width = el.parent().width(),   //to made header consistent with its parent.
                                    // if it's the last header, add space for the scrollbar equivalent unless it's centered
                                        minWidth = _getScale(el.parent().css('min-width'));
                                    width = Math.max(minWidth, width);
                                    el.css("left", headerPos);
                                    headerPos += width;
                                });
                            });
                        }

                        function resizeHeaderWidth(){
                            return tableController.reRenderHeader().then(function(){
                                var headerPos = 1,//  1 is the width of right border;
                                    tableElement = tableController.getTableElement();
                                tableController.getTableElement().find("table th .th-inner").each(function (index, el) {
                                    el = angular.element(el);
                                    var width = el.parent().width(),   //to made header consistent with its parent.
                                    // if it's the last header, add space for the scrollbar equivalent unless it's centered
                                        lastCol = tableElement.find("table th:visible:last"),
                                        minWidth = _getScale(el.parent().css('min-width'));
                                    console.log('width = %s, min-width = %s', width, minWidth);
                                    width = Math.max(minWidth, width);
                                    //following are resize stuff, to made th-inner position correct.
                                    //last column's width should be automatically, to avoid horizontal scroll.
                                    if (lastCol[0] != el.parent()[0]){
                                        el.parent().css('width', width);
                                    }
                                    el.css("left", headerPos);
                                    headerPos += width;
                                });
                            });
                        }

                        function _resetColumnsSize(tableWidth){
                            var tableElement = tableController.getTableElement(),
                                columnLength = tableElement.find("table th").length,
                                lastCol = tableElement.find("table th:last");
                            tableElement.find("table th").each(function (index, el) {
                                el = angular.element(el);
                                if(lastCol.get(0) == el.get(0)){
                                    //last column's width should be automaically, to avoid horizontal scroll.
                                    el.css('width', 'auto');
                                    return;
                                }
                                var _width = el.data('width');
                                if(/\d+%$/.test(_width)){    //percentage
                                    _width = Math.ceil(tableWidth * _getScale(_width) / 100);
                                } else {
                                    // if data-width not exist, use average width for each columns.
                                    _width = tableWidth / columnLength;
                                }
                                el.css('width', _width + 'px');
                            });
                            resizeHeaderWidth();
                        }
                    };
                }
            };
        }]);

    function _getScale(sizeCss){
        return parseInt(sizeCss.replace(/px|%/, ''));
    }
})(angular);