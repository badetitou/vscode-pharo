"
# MyClass

This an example of comment for the class `MyClass`.
It uses the markdown format.

I do 

1. a test 
2. and something else
3. hover the class name MyClass in a playground file

"
Class {
    #name: #MyClass,
    #superclass: #Object,
    #instVars: [ #myVar2 ],
    #category : #'MyPackage'
}

{ #category : #accessing }
MyClass >> helloWorld [
    ^ 'hello world'
]

{ #category : #accessing }
MyClass >> myVar2 [
    ^ myVar2
]

{ #category : #accessing }
MyClass >> myVar2: anObject [
    myVar2 := anObject
]