# my.chooseFileFromDisk

## 入参
|属性	| 类型	| 默认值	| 必填	| 描述 |
|.....|....|....|....|.....|
|success|	Function	|-	|否| 调用成功的回调函数|
|fail |	Function	|-	 | 否	| 调用失败的回调函数|
|complete	| Function	| -	  | 否|	调用结束的回调函数（调用成功、失败都会执行） |

## success 回调函数
|属性	|类型	|描述|
|.....|.....|....|
|apFilePath| String | 本地文件路径|
|fileName| String | 文件名称|