import Testing
@testable import Vantari

@Test("The name comes from one constant that mirrors shared/src/product.ts")
func productName() {
    #expect(Product.name == "Vantari")
}
