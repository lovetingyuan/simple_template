# simple_template
简单的模板编译

example: [jsfiddle: todo_list](https://jsfiddle.net/tingyuan/ffgmn1hy/)

支持：
* 双花括号表达式绑定 {{ expression }}
* 条件编译 {{ if(expression) content }}
* 列表循环 {{ for(expression) content }}
* 模板变量 {{ var(expression) content }}
* 局部作用域 {{ with(expression) content }}
* 忽略编译输出 {{ ! content }}
* 事件绑定 {{ &lt;div onclick="{{@handler}}"&gt;&lt;/div&gt; }}
* 自定义方法 {{ foo(arg1, arg2, ...) }}

todo:
* 安全问题（未对模板做安全过滤和转义）
* 性能问题（模板全量更新）
